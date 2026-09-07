import type { NextConfig } from "next";
import { realpathSync } from "node:fs";

const projectRoot = realpathSync.native(process.cwd());

const nextConfig: NextConfig = {
  devIndicators: false,
  // Cloud bindings are loaded dynamically only in the hosted worker branch.
  // Leaving the module external keeps the PostgreSQL development server usable.
  serverExternalPackages: ["cloudflare:workers"],
  // 工作区上层含有其他项目的锁文件；固定为解析符号链接后的真实路径，
  // 避免 Windows 映射路径混用导致 Turbopack 重复拼接目录。
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // 生产服务器内存有限；构建采用单工作线程，避免并行静态生成触发内存峰值。
    cpus: 1,
  },
};

export default nextConfig;
