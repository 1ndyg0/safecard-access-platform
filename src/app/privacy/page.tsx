import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { getPublishedContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage({ searchParams }: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const locale = (await searchParams).locale === 'tl' ? 'tl' : 'en';
  const filipino = locale === 'tl';
  const live = process.env.LAUNCH_GATES_COMPLETE === 'true'
    && process.env.NEXT_PUBLIC_DATA_MODE === 'live';
  const notice = live ? await getPublishedContent('privacy_notice', locale).catch(() => null) : null;

  return <main className="content-page" lang={filipino ? 'fil' : 'en'}>
    <header className="content-nav">
      <Link href="/"><BrandMark /></Link>
      <Link href="/help">{filipino ? 'Humingi ng tulong' : 'Get help'}</Link>
    </header>
    <article className="content-shell">
      <p className="eyebrow">{filipino ? 'Privacy at iyong mga karapatan' : 'Privacy and your rights'}</p>
      <nav aria-label="Privacy notice language">
        <Link href="/privacy?locale=tl" aria-current={filipino ? 'page' : undefined}>Filipino</Link>
        {' · '}
        <Link href="/privacy?locale=en" aria-current={!filipino ? 'page' : undefined}>English</Link>
      </nav>
      {notice ? <>
        <h1>{notice.title}</h1>
        <p>{filipino ? 'Bersiyon' : 'Version'} {notice.version}</p>
        <div data-content-version-id={notice.id}>
          {notice.body.split(/\n\s*\n/).map((paragraph, index) =>
            <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>)}
        </div>
      </> : <>
        <h1>{filipino ? 'Inihahanda ang aprubadong paunawa sa privacy.' : 'The approved privacy notice is being prepared.'}</h1>
        <p className="content-lede">{filipino
          ? 'Hindi pa bukas ang live na aplikasyon hangga’t hindi nailalathala ang aprubadong paunawa at pahintulot. Huwag maglagay ng totoong personal na impormasyon sa demonstration.'
          : 'Live applications require a published, approved privacy notice and consent text. Please do not enter real personal information in the demonstration.'}</p>
      </>}
    </article>
  </main>;
}
