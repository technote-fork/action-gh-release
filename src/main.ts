import path from 'path';
import { setFailed } from '@actions/core';
import { context, GitHub } from '@actions/github';
import { isTargetEvent } from '@technote-space/filter-github-action';
import { Logger, ContextHelper } from '@technote-space/github-action-helper';
import { parseConfig, isTag } from './util';
import { release, upload, GitHubReleaser } from './github';
import { TARGET_EVENTS } from './constant';

/**
 * run
 */
async function run(): Promise<void> {
	const logger = new Logger();
	ContextHelper.showActionInfo(path.resolve(__dirname, '..'), logger, context);

	if (!isTargetEvent(TARGET_EVENTS, context)) {
		logger.info('This is not target event.');
		return;
	}

	const config = parseConfig(process.env);
	if (!isTag(config.github_ref)) {
		// noinspection ExceptionCaughtLocallyJS
		throw new Error('⚠️ GitHub Releases requires a tag');
	}
	const gh  = new GitHub(config.github_token);
	const rel = await release(config, new GitHubReleaser(gh));
	if (config.input_files) {
		for (const path of config.input_files) {
			await upload(gh, rel, path);
		}
	}
	console.log(`🎉 Release ready at ${rel.html_url}`);
}

run().catch(error => setFailed(error.message));
