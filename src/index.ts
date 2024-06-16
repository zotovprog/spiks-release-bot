import { Probot } from "probot";

const environment = "stage";
const variableForChange = "FRONT_ADMIN_DOCKER_IMAGE"

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    try {
      const issueComment = context.issue({
        body: "Процесс запущен!",
      });
      await context.octokit.issues.createComment(issueComment);

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const version = '0.0.2';

      const filePath = `terraform-${environment}.tfvars`;
      const mainBranch = 'main';
      const newBranch = `update-front-admin-docker-image-${version}-${Date.now()}`;

      const { data: refData } = await context.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${mainBranch}`
      });

      await context.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: refData.object.sha
      });

      const fileResponse = await context.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: newBranch
      });

      if (!('content' in fileResponse.data)) {
        throw new Error("File content not found");
      }

      const fileContent = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');

      const updatedContent = fileContent.replace(
          new RegExp(`(${variableForChange}\\s*=\\s*\"cr\\.yandex\\/[^\\"]+:)([^\\"]+)\"`),
          `$1${version}-${environment}"`
      );

      const updatedBase64Content = Buffer.from(updatedContent).toString('base64');

      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `Update ${variableForChange} to version ${version}`,
        content: updatedBase64Content,
        branch: newBranch,
        sha: fileResponse.data.sha
      });

      const { data: pullRequest } = await context.octokit.pulls.create({
        owner,
        repo,
        title: `Update ${variableForChange} to version ${version}`,
        head: newBranch,
        base: mainBranch,
        body: `This PR updates the ${variableForChange} to version ${version}.`
      });

      await context.octokit.pulls.merge({
        owner,
        repo,
        pull_number: pullRequest.number,
        merge_method: 'merge'
      });

      await context.octokit.issues.createComment(context.issue({
        body: `${variableForChange} обновлен до версии ${version}. Изменения были смержены с основной веткой.`
      }));
    }
    catch (e) {
      context.issue({
        body: e,
      });
    }
  });
};
