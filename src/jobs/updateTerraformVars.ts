const updateTerraformVars = async ({
  context,
  newVersion,
  owner,
  repo,
  environment,
  infraVariable,
}: {
  context: any;
  newVersion: string;
  owner: string;
  repo: string;
  environment: string;
  infraVariable: string;
}) => {
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

  const updatedBase64Content = Buffer.from(updatedContent).toString("base64");

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
};

export default updateTerraformVars;
