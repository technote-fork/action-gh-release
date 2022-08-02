export interface Config {
    'github_ref': string;
    'input_name'?: string;
    'input_body'?: string;
    'input_body_path'?: string;
    'input_files'?: string[];
    'input_draft'?: boolean;
    'input_update_draft_flag'?: boolean;
    'input_update_draft_mode'?: boolean;
    'input_prerelease'?: boolean;
}
declare type Env = {
    [key: string]: string | undefined;
};
export declare const parseInputFiles: (files: string) => string[];
export declare const parseConfig: (env: Env) => Config;
export declare const releaseBody: (config: Config) => string | undefined;
export declare const paths: (patterns: string[]) => string[];
export declare const isTag: (ref: string) => boolean;
export {};
