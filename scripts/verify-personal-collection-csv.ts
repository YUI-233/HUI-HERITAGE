import { prisma } from "../lib/prisma";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.PERSONAL_COLLECTION_VERIFY_URL ?? "http://localhost:3014";
const suffix = Date.now();
const email = `personal-csv-check-${suffix}@example.local`;
const password = "PersonalCsvCheck!2026";
const directTitle = `个人书目字段验收 ${suffix}`;
const csvTitle = `个人 CSV 书目字段验收 ${suffix}`;

async function request(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

async function main() {
  try {
    const registration = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: "CSV 验收账户" }),
    });
    if (!registration.ok) throw new Error(`Registration failed (${registration.status}).`);
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!login.ok || !cookie) throw new Error(`Login failed (${login.status}).`);

    const direct = await request("/api/personal-collection/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        type: "BOOK",
        title: directTitle,
        creator: "马有林",
        era: "清",
        eraDetail: "光绪十八年",
        publicationDate: "1892",
        imprintPublisher: "京都清真寺",
        editionOrCategory: "木刻本",
        binding: "线装",
        categories: ["2.2.2 杂学（礼制仪规）", "10 学术研究"],
        volumeCount: 2,
        description: "直接录入字段验收",
      }),
    });
    if (!direct.ok) throw new Error(`Direct create failed (${direct.status}): ${JSON.stringify(await direct.json())}`);

    const csv = [
      "分类,书名,作者,册数,年代,刊刻年份,刊刻时间,刊刻主体,版本,装帧,备注",
      `2.2.2 杂学（礼制仪规）;10 学术研究,${csvTitle},金天柱,1,清,光绪十一年,1881,成都清真寺,刻本,线装,CSV 字段验收`,
    ].join("\n");
    const form = new FormData();
    form.set("type", "BOOK");
    form.set("file", new File([csv], "personal-book-metadata.csv", { type: "text/csv" }));
    const imported = await request("/api/personal-collection/items/import", { method: "POST", headers: { cookie }, body: form });
    const importBody = await imported.json() as { created?: number; message?: string };
    if (!imported.ok || importBody.created !== 1) throw new Error(`Import failed: ${JSON.stringify(importBody)}`);
    const xlsxForm = new FormData(); const xlsx = await readFile("public/templates/个人书籍导入模板（分类下拉）.xlsx");
    xlsxForm.set("type", "BOOK"); xlsxForm.set("file", new File([xlsx], "personal-book-template.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const xlsxImported = await request("/api/personal-collection/items/import", { method: "POST", headers: { cookie }, body: xlsxForm }); const xlsxBody = await xlsxImported.json() as { created?: number; message?: string };
    if (!xlsxImported.ok || xlsxBody.created !== 1) throw new Error(`Excel import failed: ${JSON.stringify(xlsxBody)}`);

    const records = await request("/api/personal-collection/items", { headers: { cookie } });
    const body = await records.json() as Array<{
      id: string; title: string; creator: string | null; era: string | null; eraDetail: string | null; publicationDate: string | null;
      imprintPublisher: string | null; editionOrCategory: string | null; binding: string | null; categories: string[]; volumeCount: number; media: Array<{ id: string }>;
    }>;
    if (!records.ok || !Array.isArray(body)) throw new Error(`Personal list failed (${records.status}): ${JSON.stringify(body)}`);
    const directRecord = body.find((item) => item.title === directTitle);
    const csvRecord = body.find((item) => item.title === csvTitle);
    if (!directRecord || !csvRecord) throw new Error("Created personal book was not returned.");
    if (directRecord.eraDetail !== "光绪十八年" || directRecord.categories.length !== 2 || directRecord.binding !== "线装") throw new Error("Direct personal book metadata was not stored.");
    if (csvRecord.creator !== "金天柱" || csvRecord.publicationDate !== "1881" || csvRecord.imprintPublisher !== "成都清真寺" || csvRecord.binding !== "线装" || csvRecord.categories.length !== 2) throw new Error("CSV personal book metadata was not stored.");
    const imageForm = new FormData(); imageForm.set("file", new File(["personal-image-verification"], "cover.png", { type: "image/png" }));
    const uploaded = await request(`/api/personal-collection/items/${directRecord.id}/media`, { method: "POST", headers: { cookie }, body: imageForm });
    const uploadedBody = await uploaded.json() as { id?: string; message?: string };
    if (!uploaded.ok || !uploadedBody.id) throw new Error(`Personal image upload failed: ${JSON.stringify(uploadedBody)}`);
    const anonymousImage = await request(`/api/personal-collection/items/${directRecord.id}/media/${uploadedBody.id}`);
    if (anonymousImage.status !== 401) throw new Error("Personal image must not be publicly readable.");
    const privateImage = await request(`/api/personal-collection/items/${directRecord.id}/media/${uploadedBody.id}`, { headers: { cookie } });
    if (!privateImage.ok || await privateImage.text() !== "personal-image-verification") throw new Error("Personal image was not readable by its owner.");
    const removedImage = await request(`/api/personal-collection/items/${directRecord.id}/media`, { method: "DELETE", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ mediaId: uploadedBody.id }) });
    if (!removedImage.ok) throw new Error("Personal image removal failed.");
    const editedTitle = `${directTitle}-updated`;
    const updated = await request("/api/personal-collection/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...directRecord, type: "BOOK", title: editedTitle, creator: "Edited author", categories: ["1.1.1 edited category"], volumeCount: 3 }),
    });
    if (!updated.ok) throw new Error(`Personal book update failed (${updated.status}): ${JSON.stringify(await updated.json())}`);
    const afterUpdate = await request("/api/personal-collection/items", { headers: { cookie } });
    const updatedRows = await afterUpdate.json() as Array<{ id: string; title: string; creator: string | null; categories: string[]; volumeCount: number }>;
    const editedRecord = updatedRows.find((item) => item.title === editedTitle);
    if (!editedRecord || editedRecord.creator !== "Edited author" || editedRecord.categories[0] !== "1.1.1 edited category" || editedRecord.volumeCount !== 3) throw new Error("Personal book edit was not persisted.");
    const deleted = await request("/api/personal-collection/items", {
      method: "DELETE", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ id: editedRecord.id, type: "BOOK" }),
    });
    if (!deleted.ok) throw new Error(`Personal book delete failed (${deleted.status}): ${JSON.stringify(await deleted.json())}`);
    const afterDelete = await request("/api/personal-collection/items", { headers: { cookie } });
    const remainingRows = await afterDelete.json() as Array<{ id: string }>;
    if (remainingRows.some((item) => item.id === editedRecord.id)) throw new Error("Personal book delete was not persisted.");
    const category = await request("/api/personal-collection/artifact-categories", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ name: "印章" }) });
    if (!category.ok || !(await category.json() as string[]).includes("印章")) throw new Error("Personal artifact category was not stored.");
    const artifact = await request("/api/personal-collection/items", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ type: "ARTIFACT", title: `个人藏品字段验收 ${suffix}`, creator: "家传", era: "清", editionOrCategory: "印章", price: "¥ 800", volumeCount: 1, description: "藏品字段验收" }) });
    const artifactBody = await artifact.json() as { id?: string; price?: string; editionOrCategory?: string; message?: string };
    if (!artifact.ok || !artifactBody.id || artifactBody.price !== "¥ 800" || artifactBody.editionOrCategory !== "印章") throw new Error(`Personal artifact create failed: ${JSON.stringify(artifactBody)}`);
    for (let index = 0; index < 3; index += 1) { const form = new FormData(); form.set("file", new File([`artifact-${index}`], `artifact-${index}.png`, { type: "image/png" })); const upload = await request(`/api/personal-collection/items/${artifactBody.id}/media`, { method: "POST", headers: { cookie }, body: form }); if (!upload.ok) throw new Error(`Artifact image ${index + 1} was not stored.`); }
    const overflowForm = new FormData(); overflowForm.set("file", new File(["artifact-overflow"], "artifact-overflow.png", { type: "image/png" }));
    const overflow = await request(`/api/personal-collection/items/${artifactBody.id}/media`, { method: "POST", headers: { cookie }, body: overflowForm });
    if (overflow.status !== 400) throw new Error("Artifact image limit was not enforced.");
    const examples = await request("/api/personal-collection/artifact-examples", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ force: true }) }); const examplesBody = await examples.json() as { created?: number; message?: string };
    if (!examples.ok || examplesBody.created !== 48) throw new Error(`Artifact examples failed: ${JSON.stringify(examplesBody)}`);
    console.log("personal_collection_ok=books,csv,excel,inline-update,private-images,delete,artifact-category,artifact-price,artifact-three-images,artifact-examples");
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
