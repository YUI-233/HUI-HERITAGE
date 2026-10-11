"use client";

import Link from "next/link";
import "./public-collections.css";

export default function PublicCollectionsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="public-collections-state-page" role="alert">
    <Link className="public-collections-state-brand" href="/">
      <img src="/brand-mark.svg" alt="" />
      <span><strong>HUI HERITAGE</strong><small>汉文回教古籍文物遗产</small></span>
    </Link>
    <section>
      <p>PERSONAL COLLECTIONS</p>
      <h1>收藏馆暂时无法加载</h1>
      <div>请求没有完成，请稍后重试。你也可以返回公开收藏馆目录。</div>
      <nav aria-label="错误处理">
        <button type="button" onClick={reset}>重新加载</button>
        <Link href="/personal-collections">返回收藏馆目录</Link>
      </nav>
    </section>
  </main>;
}

