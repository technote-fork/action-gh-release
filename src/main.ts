import { resolve } from 'path';
import { setFailed } from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { isTargetEvent } from '@technote-space/filter-github-action';
import { Logger, ContextHelper, Utils } from '@technote-space/github-action-helper';
import { parseConfig, isTag } from './util';
import { release, upload, GitHubReleaser } from './github';
import { TARGET_EVENTS } from './constant';

/**
 * run
 */
async function run(): Promise<void> {
	const logger  = new Logger();
	const context = new Context();
	ContextHelper.showActionInfo(resolve(__dirname, '..'), logger, context);

	if (!isTargetEvent(TARGET_EVENTS, context)) {
		logger.info('This is not target event.');
		return;
	}

	const config = parseConfig(process.env);
	if (!isTag(config.github_ref)) {
		// noinspection ExceptionCaughtLocallyJS
		throw new Error('⚠️ GitHub Releases requires a tag');
	}

	const octokit  = Utils.getOctokit(config.github_token);
	const releaser = await release(config, context, new GitHubReleaser(octokit));
	if (config.input_files) {
		for (const path of config.input_files) {
			await upload(octokit, context, releaser, path);
		}
	}
	console.log(`🎉 Release ready at ${releaser.html_url}`);
}

run().catch(error => setFailed(error.message));
