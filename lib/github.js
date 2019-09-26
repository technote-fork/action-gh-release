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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const fs_1 = require("fs");
const mime_1 = require("mime");
const path_1 = require("path");
/**
 * GitHubReleaser
 */
class GitHubReleaser {
    /**
     * @param {GitHub} github github
     */
    constructor(github) {
        this.github = github;
    }
    /**
     * @param {object} params params
     * @return {Promise<{ data: Release }>} release
     */
    getReleaseByTag(params) {
        return this.github.repos.getReleaseByTag(params);
    }
    /**
     * @param {object} params params
     * @return {Promise<{ data: Release }>} release
     */
    createRelease(params) {
        return this.github.repos.createRelease(params);
    }
    /**
     * @param {object} params params
     * @return {AsyncIterableIterator<{ data: Release[] }>} releases
     */
    allReleases(params) {
        return this.github.paginate.iterator(this.github.repos.listReleases.endpoint.merge(params));
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
        file: fs_1.readFileSync(path),
    };
};
exports.upload = (gh, release, path) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, size, mime, file } = exports.asset(path);
    console.log(`⬆️ Uploading ${name}...`);
    const assets = yield gh.repos.listAssetsForRelease(Object.assign(Object.assign({}, github_1.context.repo), { 'release_id': release.id }));
    const duplicated = assets.data.find(assets => assets.name === name);
    if (duplicated) {
        yield gh.repos.deleteReleaseAsset(Object.assign(Object.assign({}, github_1.context.repo), { 'asset_id': duplicated.id }));
    }
    return yield gh.repos.uploadReleaseAsset({
        url: release.upload_url,
        headers: {
            'content-length': size,
            'content-type': mime,
        },
        name,
        file,
    });
});
exports.release = (config, releaser) => __awaiter(void 0, void 0, void 0, function* () {
    var e_1, _a;
    const [owner, repo] = config.github_repository.split('/');
    const tag = config.github_ref.replace('refs/tags/', '');
    try {
        // you can't get a an existing draft by tag
        // so we must find one in the list of all releases
        if (config.input_draft) {
            try {
                for (var _b = __asyncValues(releaser.allReleases({
                    owner,
                    repo,
                })), _c; _c = yield _b.next(), !_c.done;) {
                    const response = _c.value;
                    const release = response.data.find(release => release.tag_name === tag);
                    if (release) {
                        return release;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        const release = yield releaser.getReleaseByTag({
            owner,
            repo,
            tag,
        });
        return release.data;
    }
    catch (error) {
        // eslint-disable-next-line no-magic-numbers
        if (error.status === 404) {
            try {
                const name = config.input_name || tag;
                const body = config.input_body;
                const draft = config.input_draft;
                const prerelease = config.input_prerelease;
                console.log(`👩‍🏭 Creating new GitHub release for tag ${tag}...`);
                const release = yield releaser.createRelease({
                    owner,
                    repo,
                    'tag_name': tag,
                    name,
                    body,
                    draft,
                    prerelease,
                });
                return release.data;
            }
            catch (error) {
                // presume a race with competing metrix runs
                console.log(`⚠️ GitHub release failed with status: ${error.status}, retrying...`);
                return yield exports.release(config, releaser);
            }
        }
        else {
            console.log(`⚠️ Unexpected error fetching GitHub release for tag ${config.github_ref}: ${error}`);
            throw error;
        }
    }
});
