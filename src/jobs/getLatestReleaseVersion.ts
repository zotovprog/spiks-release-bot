const getLastReleaseVersionInProject = async (
  context: any,
  owner: string,
  repo: string
): Promise<string> => {
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo,
  });

  if (releases.data.length === 0) {
    return "0.0.0";
  }

  return releases.data[0].tag_name;
};

export default getLastReleaseVersionInProject;
