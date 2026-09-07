import "../site-page.css";
import { SitePageView } from "../components/site-page";
import { getSitePagesContent } from "../../lib/site-pages";
export const dynamic = "force-dynamic";
export default async function AboutPage() { const content = await getSitePagesContent(); return <SitePageView page={content.pages.about} slug="about"/>; }
