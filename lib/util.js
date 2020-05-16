"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTag = exports.paths = exports.parseConfig = exports.parseInputFiles = void 0;
const glob = __importStar(require("glob"));
const fs_1 = require("fs");
exports.parseInputFiles = (files) => {
    return files.split(/\r?\n/).reduce((acc, line) => acc
        .concat(line.split(','))
        .filter(pat => pat)
        .map(pat => pat.trim()), []);
};
exports.parseConfig = (env) => {
    return {
        'github_ref': env.GITHUB_REF || '',
        'github_repository': env.GITHUB_REPOSITORY || '',
        'input_name': env.INPUT_NAME,
        'input_body': env.INPUT_BODY,
        'input_body_path': env.INPUT_BODY_PATH,
        'input_files': exports.parseInputFiles(env.INPUT_FILES || ''),
        'input_draft': env.INPUT_DRAFT === 'true',
        'input_prerelease': env.INPUT_PRERELEASE === 'true',
    };
};
exports.paths = (patterns) => {
    return patterns.reduce((acc, pattern) => {
        return acc.concat(glob.sync(pattern).filter(path => fs_1.lstatSync(path).isFile()));
    }, []);
};
exports.isTag = (ref) => {
    return ref.startsWith('refs/tags/');
};
