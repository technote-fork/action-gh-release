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
const fs_1 = require("fs");
const mime_1 = require("mime");
const path_1 = require("path");
/**
 * GitHubReleaser
 */
class GitHubReleaser {
    /**
     * @param {Octokit} github github
     */
    constructor(github) {
        this.github = github;
    }
    /**
     * @param {object} params params
     * @return {Promise<{ data: Release }>} release
     */
    getReleaseByTag(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.github.repos.getReleaseByTag(params)).data;
        });
    }
    /**
     * @param {object} params params
     * @return {Promise<{ data: Release }>} release
     */
    createRelease(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.github.repos.createRelease(params)).data;
        });
    }
    /**
     * @param {object} params params
     * @return {Promise<Release[]>} releases
     */
    allReleases(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.github.paginate(this.github.repos.listReleases, params)).map(item => item);
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
        size: fs_1.lstatSync(path).size,
        file: fs_1.readFileSync(path).toString(),
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
    return (yield octokit.repos.uploadReleaseAsset(Object.assign(Object.assign({}, context.repo), { baseUrl: release.upload_url.replace(/\/repos\/.+$/, ''), 'release_id': release.id, name, data: file, headers: {
            'content-length': size,
            'content-type': mime,
        } }))).data;
});
exports.release = (config, context, releaser) => __awaiter(void 0, void 0, void 0, function* () {
    const [owner, repo] = config.github_repository.split('/');
    const tag = config.github_ref.replace('refs/tags/', '');
    try {
        // you can't get a an existing draft by tag
        // so we must find one in the list of all releases
        if (config.input_draft) {
            const releases = yield releaser.allReleases({
                owner,
                repo,
            });
            const release = releases.find(release => release.tag_name === tag);
            if (release) {
                return release;
            }
        }
        return yield releaser.getReleaseByTag({
            owner,
            repo,
            tag,
        });
    }
    catch (error) {
        // eslint-disable-next-line no-magic-numbers
        if (error.status === 404) {
            try {
                const name = config.input_name || tag;
                const body = config.input_body;
                const draft = config.input_draft;
                const prerelease = config.input_prerelease;
                console.log(`👩‍🏭 Creating new Octokit release for tag ${tag}...`);
                return yield releaser.createRelease({
                    owner,
                    repo,
                    'tag_name': tag,
                    name,
                    body,
                    draft,
                    prerelease,
                });
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
