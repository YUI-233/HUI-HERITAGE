const config = {
  plugins: {
    // 上层工作区包含其他项目，固定 Tailwind 的扫描与依赖解析范围。
    "@tailwindcss/postcss": { base: process.cwd() },
  },
};

export default config;
