import path from 'path';
import { parseConfig, isTag } from './util';
import { release, upload, GitHubReleaser } from './github';
import { setFailed } from '@actions/core';
import { context, GitHub } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { isTargetEvent } from '@technote-space/filter-github-action';
import { Logger, Utils, ContextHelper } from '@technote-space/github-action-helper';

const {isSemanticVersioningTagName} = Utils;
const {showActionInfo, getTagName}  = ContextHelper;

/**
 * run
 */
async function run(): Promise<void> {
	const logger = new Logger();
	showActionInfo(path.resolve(__dirname, '..'), logger, context);

	if (!isTargetEvent({
		'push': [
			(context: Context): boolean => isSemanticVersioningTagName(getTagName(context)),
		],
	}, context)) {
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
