import { Context } from "probot";

const getLastReleaseVersionInProject = async (
  context: Context<"issues">,
  owner: string,
  repo: string
): Promise<{ version: string; timestamp?: Date }> => {
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo,
  });

  if (releases.data.length === 0) {
    return { version: "0.0.0" };
  }

  if (releases.data.length > 0) {
    const lastRelease = releases.data[0];
    const version = lastRelease.tag_name;
    const timestamp = new Date(lastRelease.published_at ?? 0);
    return { version, timestamp };
  } else {
    // Handle case when no releases are found
    throw new Error("No previous releases found.");
  }
};

export default getLastReleaseVersionInProject;
