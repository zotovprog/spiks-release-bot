import { Probot } from "probot";
import {
  getNextVersion,
  updateTerraformVars,
  getLastReleaseVersion,
} from "./jobs/index.js";
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

      if (!shouldStartProcess) return;

      await context.octokit.issues.createComment(
        context.issue({
          body: `Начинаю выпуск релиза`,
        })
      );

      // Получаем данные о репозиториях из файла repository-database.json
      // Получаем его через github для того, чтобы всегда иметь актуальное состояние файла
      const repositoryInfoData = await context.octokit.repos.getContent({
        owner: "zotovprog",
        repo: "spiks-release-bot",
        path: "repository-database.json",
        ref: "main",
      });

      const fileContent = Buffer.from(
        // @ts-ignore
        repositoryInfoData.data.content,
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

      const { environments, releaseType } = parseIssueTitle(issueName);

      const environment = environments[0];

      const previousReleaseVersion = await getLastReleaseVersion(
        context,
        owner,
        repo
      );

      const newVersion = getNextVersion(previousReleaseVersion, releaseType);

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
