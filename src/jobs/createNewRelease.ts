import { Context } from "probot";

const createNewRelease = async ({
  context,
  newVersion,
  owner,
  repo,
  lastReleaseTimestamp,
}: {
  context: Context<"issues">;
  newVersion: string;
  owner: string;
  repo: string;
  lastReleaseTimestamp: Date | undefined;
}) => {
  const pullRequests = await context.octokit.pulls.list({
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
  });

  const pullRequestsSinceLastRelease = pullRequests.data.filter((pr) =>
    pr.merged_at && lastReleaseTimestamp
      ? new Date(pr.merged_at) > lastReleaseTimestamp
      : true
  );

  const pullRequestsLinks = pullRequestsSinceLastRelease
    .filter((pr) => pr.merged_at && pr.base.ref === "main")
    .map((pr) => `- ${pr.title} (#${pr.number})`);

  // TODO: Здесь надо проверять pr на теги и по ним составлять красивое описание при использовании commitLint
  const releaseBody = `### Список изменений:\n${pullRequestsLinks.join("\n")}`;
  await context.octokit.repos.createRelease({
    owner,
    repo,
    tag_name: newVersion,
    name: `Release ${newVersion}`,
    body: releaseBody,
    draft: false,
    prerelease: false,
  });

  // Comment that release process is complete
  await context.octokit.issues.createComment(
    context.issue({
      body: `Релиз с версией \`${newVersion}\` был успешно создан.`,
    })
  );
};

export default createNewRelease;
