declare module "*.css";
declare module "*.scss";
declare module "*.sass";
declare module "*.less";

declare const process: {
  env: Record<string, string | undefined>;
  cwd: () => string;
};

declare module "*.svg" {
  import * as React from "react";
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  const src: string;
  export default src;
}