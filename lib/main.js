"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const core_1 = require("@actions/core");
const context_1 = require("@actions/github/lib/context");
const filter_github_action_1 = require("@technote-space/filter-github-action");
const github_action_helper_1 = require("@technote-space/github-action-helper");
const github_action_log_helper_1 = require("@technote-space/github-action-log-helper");
const util_1 = require("./util");
const github_1 = require("./github");
const constant_1 = require("./constant");
/**
 * run
 */
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const logger = new github_action_log_helper_1.Logger();
        const context = new context_1.Context();
        github_action_helper_1.ContextHelper.showActionInfo((0, path_1.resolve)(__dirname, '..'), logger, context);
        if (!(0, filter_github_action_1.isTargetEvent)(constant_1.TARGET_EVENTS, context)) {
            logger.info('This is not target event.');
            return;
        }
        const config = (0, util_1.parseConfig)(process.env);
        if (!(0, util_1.isTag)(config.github_ref)) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('⚠️ GitHub Releases requires a tag');
        }
        const octokit = github_action_helper_1.Utils.getOctokit();
        const releaser = yield (0, github_1.release)(config, context, new github_1.GitHubReleaser(octokit));
        if (config.input_files) {
            for (const path of config.input_files) {
                yield (0, github_1.upload)(octokit, context, releaser, path);
            }
        }
        console.log(`🎉 Release ready at ${releaser.html_url}`);
    });
}
run().catch(error => (0, core_1.setFailed)(error.message));
