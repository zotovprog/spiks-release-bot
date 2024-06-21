import { Probot } from "probot";
import { getNextVersion } from "./jobs/getNextVersion.js";
import { getLastReleaseVersionInProject } from "./jobs/getLatestReleaseVersion.js";
import { parseIssueTitle } from "./utils/parseIssueTitle.js";
import { RepositoryDatabase } from "./types/repositoryDatabase.js";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    try {
      const issueLabels = context.payload.issue.labels?.map(
        (label: { name: string }) => label.name
      );

      // Условие для запуска процесса - наличие метки "release-bot"
      const shouldStartProcess = issueLabels?.includes("release-bot");

      if (shouldStartProcess) {
        const fileResponse = await context.octokit.repos.getContent({
          owner: "zotovprog",
          repo: "spiks-release-bot",
          path: "repository-database.json",
          ref: "main",
        });

        const fileContent = Buffer.from(
          // @ts-ignore
          fileResponse.data.content,
          "base64"
        ).toString("utf-8");

        const jsonContent = JSON.parse(fileContent);

        const owner = context.payload.repository.owner.login;
        const repo = context.payload.repository.name;

        const { infraVariable } = jsonContent.find(
          (repositoryData: RepositoryDatabase) =>
            repositoryData.repositoryName === repo
        );

        const issueName = context.payload.issue.title;

        console.log(issueName);

        const { environments, releaseType } = parseIssueTitle(issueName);

        const environment = environments[0];

        const previousReleaseVersion = await getLastReleaseVersionInProject(
          context,
          owner,
          repo
        );

        const newVersion = getNextVersion(previousReleaseVersion, releaseType);

        const mainBranch = "main";
        const newBranch = `update-front-admin-docker-image-${newVersion}-${Date.now()}`;

        const { data: refData } = await context.octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${mainBranch}`,
        });

        await context.octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${newBranch}`,
          sha: refData.object.sha,
        });

        // const pullRequestsResponse = await context.octokit.pulls.list({
        //   owner,
        //   repo,
        //   state: "closed",
        //   base: mainBranch,
        //   sort: "updated",
        //   direction: "desc",
        // });

        // const pullRequests = pullRequestsResponse.data.filter(
        //   (pr) => pr.merged_at
        // );

        const filePath = `terraform-${environment}.tfvars`;

        const varsFileResponse = await context.octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: newBranch,
        });

        if (!("content" in varsFileResponse.data)) {
          throw new Error("File content not found");
        }

        const varsFileContent = Buffer.from(
          varsFileResponse.data.content,
          "base64"
        ).toString("utf-8");

        const updatedContent = varsFileContent.replace(
          new RegExp(
            `(${infraVariable}\\s*=\\s*\"cr\\.yandex\\/[^\\"]+:)([^\\"]+)\"`
          ),
          `$1${newVersion}-${environment}"`
        );

        const updatedBase64Content =
          Buffer.from(updatedContent).toString("base64");

        await context.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: `Update ${infraVariable} to version ${newVersion}`,
          content: updatedBase64Content,
          branch: newBranch,
          sha: varsFileResponse.data.sha,
        });

        const { data: pullRequest } = await context.octokit.pulls.create({
          owner,
          repo,
          title: `Update ${infraVariable} to version ${newVersion}`,
          head: newBranch,
          base: mainBranch,
          body: `This PR updates the ${infraVariable} to version ${newVersion}.`,
        });

        await context.octokit.pulls.merge({
          owner,
          repo,
          pull_number: pullRequest.number,
          merge_method: "merge",
        });

        await context.octokit.issues.createComment(
          context.issue({
            body: `${infraVariable} обновлен до версии ${newVersion}. Изменения были смержены с основной веткой.`,
          })
        );

        // let releaseNotes = "## Release Notes\n\n";
        // for (const pr of pullRequests) {
        //   releaseNotes += `### ${pr.title}\n${pr.body}\n\n`;
        // }
        //
        // await context.octokit.issues.createComment(context.issue({
        //   body: `Пожалуйста, проверьте заметки для релиза:\n\n${releaseNotes}\n\nОтветьте на этот комментарий с подтверждением или изменениями.`,
        // }));
        //
        // // Следить за ответами пользователя в этом issue
        // app.on("issue_comment.created", async (commentContext) => {
        //   const comment = commentContext.payload.comment.body;
        //   const issueNumber = commentContext.payload.issue.number;
        //
        //   // Проверить, что комментарий оставлен в том же issue
        //   if (issueNumber === context.payload.issue.number) {
        //     // Создать новый релиз с сообщением пользователя
        //     const newReleaseResponse = await commentContext.octokit.repos.createRelease({
        //       owner,
        //       repo,
        //       tag_name: `v${version}`,
        //       name: `Release v${version}`,
        //       body: comment,
        //       draft: false,
        //       prerelease: false,
        //     });
        //
        //     const newReleaseUrl = newReleaseResponse.data.html_url;
        //
        //     await commentContext.octokit.issues.createComment(context.issue({
        //       body: `Новый релиз создан: [Release v${version}](${newReleaseUrl}). Теперь начинаем обновление terraform файла.`
        //     }));
        //
        //   }
        // });
      }
    } catch (e) {
      await context.octokit.issues.createComment(
        context.issue({
          body: `Произошла ошибка: ${e}`,
        })
      );
    }
  });
};
