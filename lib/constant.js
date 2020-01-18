"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const github_action_helper_1 = require("@technote-space/github-action-helper");
const { isSemanticVersioningTagName } = github_action_helper_1.Utils;
const { getTagName } = github_action_helper_1.ContextHelper;
exports.TARGET_EVENTS = {
    'push': [
        (context) => isSemanticVersioningTagName(getTagName(context)),
    ],
};
