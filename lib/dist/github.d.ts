/// <reference types="node" />
import type { Config } from './util';
import type { Context } from '@actions/github/lib/context';
import type { components } from '@octokit/openapi-types';
import type { Octokit } from '@technote-space/github-action-helper/dist/types';
type ReposUploadReleaseAssetResponseData = components['schemas']['release-asset'];
type ReposListReleasesResponseData = components['schemas']['release'];
type ReposCreateReleaseResponseData = components['schemas']['release'];
type ReposUpdateReleaseResponseData = components['schemas']['release'];
type ReposGetReleaseByTagResponseData = components['schemas']['release'];
export interface ReleaseAsset {
    name: string;
    mime: string;
    size: number;
    file: Buffer;
}
export interface Release {
    id: number;
    'upload_url': string;
    'html_url': string;
    'tag_name': string;
}
export interface Releaser {
    getReleaseByTag(params: {
        owner: string;
        repo: string;
        tag: string;
    }): Promise<ReposGetReleaseByTagResponseData>;
    createRelease(params: {
        owner: string;
        repo: string;
        'tag_name': string;
        name: string;
        body: string | undefined;
        draft: boolean | undefined;
        prerelease: boolean | undefined;
    }): Promise<ReposCreateReleaseResponseData>;
    updateRelease(params: {
        owner: string;
        repo: string;
        'release_id': number;
        'tag_name': string;
        'target_commitish': string;
        name: string;
        body: string | undefined;
        draft: boolean | undefined;
        prerelease: boolean | undefined;
    }): Promise<ReposUpdateReleaseResponseData>;
    allReleases(params: {
        owner: string;
        repo: string;
    }): Promise<Array<ReposListReleasesResponseData>>;
}
/**
 * GitHubReleaser
 */
export declare class GitHubReleaser implements Releaser {
    octokit: Octokit;
    /**
     * @param {Octokit} octokit octokit
     */
    constructor(octokit: Octokit);
    /**
     * @param {object} params params
     * @return {Promise<ReposGetReleaseByTagResponseData>} release
     */
    getReleaseByTag(params: {
        owner: string;
        repo: string;
        tag: string;
    }): Promise<ReposGetReleaseByTagResponseData>;
    /**
     * @param {object} params params
     * @return {Promise<ReposCreateReleaseResponseData>} release
     */
    createRelease(params: {
        owner: string;
        repo: string;
        'tag_name': string;
        name: string;
        body?: string | undefined;
        draft?: boolean | undefined;
        prerelease?: boolean | undefined;
    }): Promise<ReposCreateReleaseResponseData>;
    /**
     * @param {object} params params
     * @return {Promise<ReposUpdateReleaseResponseData>} release
     */
    updateRelease(params: {
        owner: string;
        repo: string;
        'release_id': number;
        'tag_name': string;
        'target_commitish': string;
        name: string;
        body: string | undefined;
        draft: boolean | undefined;
        prerelease: boolean | undefined;
    }): Promise<ReposUpdateReleaseResponseData>;
    /**
     * @param {object} params params
     * @return {Promise<Array<ReposListReleasesResponseData>>} releases
     */
    allReleases(params: {
        owner: string;
        repo: string;
    }): Promise<Array<ReposListReleasesResponseData>>;
}
export declare const mimeOrDefault: (path: string) => string;
export declare const asset: (path: string) => ReleaseAsset;
export declare const upload: (octokit: Octokit, context: Context, release: Release, path: string) => Promise<ReposUploadReleaseAssetResponseData>;
export declare const release: (config: Config, context: Context, releaser: Releaser) => Promise<Release>;
export {};
