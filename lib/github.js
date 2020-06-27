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
exports.release = exports.upload = exports.asset = exports.mimeOrDefault = exports.GitHubReleaser = void 0;
const util_1 = require("./util");
const fs_1 = require("fs");
const mime_1 = require("mime");
const path_1 = require("path");
/**
 * GitHubReleaser
 */
class GitHubReleaser {
    /**
     * @param {Octokit} octokit octokit
     */
    constructor(octokit) {
        this.octokit = octokit;
    }
    /**
     * @param {object} params params
     * @return {Promise<ReposGetReleaseByTagResponseData>} release
     */
    getReleaseByTag(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.octokit.repos.getReleaseByTag(params)).data;
        });
    }
    /**
     * @param {object} params params
     * @return {Promise<ReposCreateReleaseResponseData>} release
     */
    createRelease(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.octokit.repos.createRelease(params)).data;
        });
    }
    /**
     * @param {object} params params
     * @return {Promise<ReposUpdateReleaseResponseData>} release
     */
    updateRelease(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.octokit.repos.updateRelease(params)).data;
        });
    }
    /**
     * @param {object} params params
     * @return {Promise<ReposListReleasesResponseData>} releases
     */
    allReleases(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.octokit.paginate(this.octokit.repos.listReleases, params)).map(item => item);
        });
    }
}
exports.GitHubReleaser = GitHubReleaser;
exports.mimeOrDefault = (path) => {
    return mime_1.getType(path) || 'application/octet-stream';
};
exports.asset = (path) => {
    return {
        name: path_1.basename(path),
        mime: exports.mimeOrDefault(path),
        size: fs_1.statSync(path).size,
        file: fs_1.readFileSync(path),
    };
};
exports.upload = (octokit, context, release, path) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, size, mime, file } = exports.asset(path);
    console.log(`⬆️ Uploading ${name}...`);
    const assets = yield octokit.paginate(octokit.repos.listReleaseAssets, Object.assign(Object.assign({}, context.repo), { 'release_id': release.id }));
    const duplicated = assets.find(assets => assets.name === name);
    if (duplicated) {
        yield octokit.repos.deleteReleaseAsset(Object.assign(Object.assign({}, context.repo), { 'asset_id': duplicated.id }));
    }
    return (yield octokit.repos.uploadReleaseAsset(Object.assign(Object.assign({}, context.repo), { baseUrl: release.upload_url.replace(/\/repos\/.+$/, ''), 'release_id': release.id, name, data: file.toString('binary'), headers: {
            'content-length': size,
            'content-type': mime,
        } }))).data;
});
const getRelease = (tag, config, context, releaser) => __awaiter(void 0, void 0, void 0, function* () {
    // you can't get a an existing draft by tag
    // so we must find one in the list of all releases
    const releases = yield releaser.allReleases(Object.assign({}, context.repo));
    const release = releases.find(release => release.tag_name === tag);
    if (release) {
        return release;
    }
    return releaser.getReleaseByTag(Object.assign(Object.assign({}, context.repo), { tag }));
});
exports.release = (config, context, releaser) => __awaiter(void 0, void 0, void 0, function* () {
    const tag = config.github_ref.replace('refs/tags/', '');
    try {
        const release = yield getRelease(tag, config, context, releaser);
        if (config.input_update_draft_flag && config.input_update_draft_mode !== release.draft) {
            return yield releaser.updateRelease(Object.assign(Object.assign({}, context.repo), { 'release_id': release.id, 'tag_name': tag, 'target_commitish': release.target_commitish, name: config.input_name || tag, body: `${release.body}\n${util_1.releaseBody(config)}`, draft: config.input_update_draft_mode, prerelease: config.input_prerelease }));
        }
        return release;
    }
    catch (error) {
        // eslint-disable-next-line no-magic-numbers
        if (error.status === 404) {
            try {
                console.log(`👩‍🏭 Creating new Octokit release for tag ${tag}...`);
                return yield releaser.createRelease(Object.assign(Object.assign({}, context.repo), { 'tag_name': tag, name: config.input_name || tag, body: util_1.releaseBody(config), draft: config.input_draft, prerelease: config.input_prerelease }));
            }
            catch (error) {
                // presume a race with competing metrix runs
                console.log(`⚠️ Octokit release failed with status: ${error.status}, retrying...`);
                return yield exports.release(config, context, releaser);
            }
        }
        else {
            console.log(`⚠️ Unexpected error fetching Octokit release for tag ${config.github_ref}: ${error}`);
            throw error;
        }
    }
});
