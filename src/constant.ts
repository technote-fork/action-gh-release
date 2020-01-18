import { Context } from '@actions/github/lib/context';
import { Utils, ContextHelper } from '@technote-space/github-action-helper';

const {isSemanticVersioningTagName} = Utils;
const {getTagName}                  = ContextHelper;

export const TARGET_EVENTS = {
	'push': [
		(context: Context): boolean => isSemanticVersioningTagName(getTagName(context)),
	],
};
