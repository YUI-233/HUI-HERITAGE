INSERT INTO books (id, title, dynasty, version_type, description, source, status)
VALUES
  ('qingzhen-shiyi', '清真释疑', '清代', '道光十六年刻本', '以饮食、礼仪等主题阐释教义的汉文经堂文献。', '成都清真寺藏版', 'APPROVED'),
  ('qingzhen-shiyi-supplement', '清真释疑补辑', '清代', '光绪十一年刻本', '《清真释疑》的补辑刻本，保存有馆藏题记与版刻信息。', '成都清真寺藏版', 'APPROVED'),
  ('guizhen-biyao', '归真必要', '清代', '卷一第五篇', '汉文伊斯兰经堂教育文献，现收录卷一第五篇页面。', '馆藏图像', 'APPROVED'),
  ('five-duties', '五功释义', '近代', '馆藏封面', '以五功为主题的汉文教义文献封面。', '馆藏封面', 'APPROVED')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, dynasty = EXCLUDED.dynasty, version_type = EXCLUDED.version_type, description = EXCLUDED.description, source = EXCLUDED.source, status = EXCLUDED.status, updated_at = now();

INSERT INTO artifacts (id, title, category, era, description, source, status)
VALUES
  ('arabic-manuscript', '阿拉伯文彩绘手抄本', '文献图像', '待考', '带有花卉装饰与经文书写的阿拉伯文手抄本页面。', '公开图像资料', 'APPROVED'),
  ('astronomy', '中阿天文学图册', '文献图像', '待考', '呈现中阿知识交流的天文图示与阿拉伯文说明。', '公开图像资料', 'APPROVED')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, era = EXCLUDED.era, description = EXCLUDED.description, source = EXCLUDED.source, status = EXCLUDED.status, updated_at = now();

INSERT INTO media_assets (id, storage_key, mime_type, visibility, book_id, artifact_id)
VALUES
  ('media-qingzhen-shiyi', 'private/manuscripts/qingzhen-shiyi-1836.jpg', 'image/jpeg', 'MEMBER_ONLY', 'qingzhen-shiyi', NULL),
  ('media-qingzhen-shiyi-supplement', 'private/manuscripts/qingzhen-shiyi-supplement.jpg', 'image/jpeg', 'MEMBER_ONLY', 'qingzhen-shiyi-supplement', NULL),
  ('media-guizhen-biyao', 'private/manuscripts/guizhen-page.png', 'image/png', 'MEMBER_ONLY', 'guizhen-biyao', NULL),
  ('media-five-duties', 'private/manuscripts/five-duties.png', 'image/png', 'MEMBER_ONLY', 'five-duties', NULL),
  ('media-arabic-manuscript', 'collection/arabic-manuscript.png', 'image/png', 'PUBLIC', NULL, 'arabic-manuscript'),
  ('media-astronomy', 'collection/astronomy-open-book.png', 'image/png', 'PUBLIC', NULL, 'astronomy')
ON CONFLICT (id) DO UPDATE SET storage_key = EXCLUDED.storage_key, mime_type = EXCLUDED.mime_type, visibility = EXCLUDED.visibility, book_id = EXCLUDED.book_id, artifact_id = EXCLUDED.artifact_id;

UPDATE books SET keywords = ARRAY['清真释疑', '道光', '成都', '经堂教育'] WHERE id = 'qingzhen-shiyi';
UPDATE books SET keywords = ARRAY['清真释疑补辑', '光绪', '成都', '清真寺'] WHERE id = 'qingzhen-shiyi-supplement';
UPDATE books SET keywords = ARRAY['归真必要', '经堂教育', '释遵道之实'] WHERE id = 'guizhen-biyao';
UPDATE books SET keywords = ARRAY['五功释义', '五功', '教义'] WHERE id = 'five-duties';
UPDATE artifacts SET keywords = ARRAY['阿拉伯文', '手抄本', '经文', '彩绘'] WHERE id = 'arabic-manuscript';
UPDATE artifacts SET keywords = ARRAY['天文学', '阿拉伯文', '图册', '中阿交流'] WHERE id = 'astronomy';

INSERT INTO holdings (id, institution, region, origin, call_number, catalog_url, description, status, book_id, artifact_id)
VALUES
  ('holding-chengdu-qingzhen-shiyi', '成都清真寺', '中国·四川成都', 'DOMESTIC', '道光十六年刻本', NULL, '依据封面与馆藏题记整理的公开馆藏记录。', 'APPROVED', 'qingzhen-shiyi', NULL),
  ('holding-chengdu-qingzhen-supplement', '成都清真寺', '中国·四川成都', 'DOMESTIC', '光绪十一年重镌', NULL, '《清真释疑补辑》馆藏记录，含版刻信息。', 'APPROVED', 'qingzhen-shiyi-supplement', NULL),
  ('holding-public-guizhen', '公开图像资料', '待考', 'PERSONAL', '卷一第五篇', NULL, '由已公开的页面图像建立的待考记录。', 'APPROVED', 'guizhen-biyao', NULL),
  ('holding-arabic-manuscript', '公开图像资料', '海外·待考', 'OVERSEAS', NULL, NULL, '阿拉伯文彩绘手抄本文献图像的公开记录。', 'APPROVED', NULL, 'arabic-manuscript'),
  ('holding-astronomy', '公开图像资料', '海外·待考', 'OVERSEAS', NULL, NULL, '中阿天文学图册的公开图像资料记录。', 'APPROVED', NULL, 'astronomy')
ON CONFLICT (id) DO UPDATE SET institution = EXCLUDED.institution, region = EXCLUDED.region, origin = EXCLUDED.origin, call_number = EXCLUDED.call_number, catalog_url = EXCLUDED.catalog_url, description = EXCLUDED.description, status = EXCLUDED.status, book_id = EXCLUDED.book_id, artifact_id = EXCLUDED.artifact_id, updated_at = now();

INSERT INTO research_articles (id, title, author, publication, summary, category, keywords, related_record_ids, status)
VALUES
  ('jing-tang-education', '经堂教育与汉文教义', NULL, 'HUI HERITAGE 研究路径', '从《清真释疑》《归真必要》《五功释义》等线索，观察汉文伊斯兰知识的讲授、阐释与保存。', '古籍研究', ARRAY['经堂教育', '汉文教义', '清真释疑'], ARRAY['qingzhen-shiyi', 'guizhen-biyao', 'five-duties'], 'APPROVED'),
  ('edition-and-provenance', '版本、题记与收藏来源', NULL, 'HUI HERITAGE 研究路径', '将刊刻年代、寺院藏版与馆藏题记作为资料线索，追踪文本在不同地区的流传与整理。', '文献学研究', ARRAY['版本', '题记', '成都清真寺'], ARRAY['qingzhen-shiyi', 'qingzhen-shiyi-supplement'], 'APPROVED'),
  ('sino-arabic-knowledge', '中阿知识交流图像', NULL, 'HUI HERITAGE 研究路径', '通过阿拉伯文手抄本与天文学图册，进入文字、图像与知识体系之间的交流现场。', '知识交流', ARRAY['阿拉伯文', '天文学', '中阿交流'], ARRAY['arabic-manuscript', 'astronomy'], 'APPROVED')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, publication = EXCLUDED.publication, summary = EXCLUDED.summary, category = EXCLUDED.category, keywords = EXCLUDED.keywords, related_record_ids = EXCLUDED.related_record_ids, status = EXCLUDED.status, updated_at = now();

INSERT INTO site_settings (key, value)
VALUES ('home_hero', '{"desktopImagePath":null,"mobileImagePath":null,"altText":"","attribution":"","desktopFocus":"center center","mobileFocus":"center center"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
