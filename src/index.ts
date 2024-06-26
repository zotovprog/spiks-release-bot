import { OctokitOptions } from "probot/lib/types.js";
import { RepositoryDatabase } from "./types/repositoryDatabase.js";
import { Context, Probot } from "probot";
import {
  createNewRelease,
  getLastReleaseVersion,
  getNextVersion,
  updateTerraformVars,
} from "./jobs/index.js";
import { parseIssueTitle } from "./utils/parseIssueTitle.js";

export default (app: Probot) => {
  app.on("issues.opened", async (context: Context<"issues">) => {
    try {
      const issueLabels = context.payload.issue.labels?.map(
        (label: { name: string }) => label.name
      );

      // Условие для запуска процесса - наличие метки "release-bot"
      const shouldStartProcess = issueLabels?.includes("release-bot");

      if (!shouldStartProcess) return;

      await context.octokit.issues.createComment(
        context.issue({
          body: `Начинаю выпуск релиза`,
        })
      );

      // Получаем данные о репозиториях из файла repository-database.json
      // Получаем его через github для того, чтобы всегда иметь актуальное состояние файла

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;

      const issueName = context.payload.issue.title;

      const { environments, releaseType } = parseIssueTitle(issueName);

      const {
        version: previousReleaseVersion,
        timestamp: lastReleaseTimestamp,
      } = await getLastReleaseVersion(context, owner, repo);

      const newVersion = getNextVersion(previousReleaseVersion, releaseType);

      await createNewRelease({
        context,
        newVersion,
        owner,
        repo,
        lastReleaseTimestamp,
      });

      const repositoryInfoData: OctokitOptions =
        await context.octokit.repos.getContent({
          owner: "zotovprog",
          repo: "spiks-release-bot",
          path: "repository-database.json",
          ref: "main",
        });

      const fileContent = Buffer.from(
        repositoryInfoData.data.content,
        "base64"
      ).toString("utf-8");

      const jsonContent = JSON.parse(fileContent);

      const { infraVariable } = jsonContent.find(
        (repositoryData: RepositoryDatabase) =>
          repositoryData.repositoryName === repo
      );

      const environment = environments[0];

      // Обновляем версию в инфре
      await updateTerraformVars({
        context,
        newVersion,
        owner,
        repo,
        environment,
        infraVariable,
      });
    } catch (e) {
      await context.octokit.issues.createComment(
        context.issue({
          body: `Произошла ошибка: ${e}`,
        })
      );
    }
  });
};
