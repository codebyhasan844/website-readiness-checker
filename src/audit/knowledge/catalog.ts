/**
 * Audit Knowledge Catalog (Phase 3)
 *
 * Predefined, authoritative repository of plain-English explanations,
 * business/technical impacts (Why it matters), and concrete recommendations
 * for all audit checks. Strictly deterministic, zero AI or LLM dependency.
 */

export interface KnowledgeEntry {
  title: string;
  explanation: string;
  whyItMatters: string;
  recommendation: string;
}

export const KNOWLEDGE_CATALOG: Record<string, KnowledgeEntry> = {
  // Category A: Technical / Launch
  'tech-website-reachable': {
    title: 'Website Reachability',
    explanation: 'Verifies whether the web server responds to HTTP requests without fatal connection drops or DNS failures.',
    whyItMatters: 'If the server is unreachable, neither users nor search engine crawlers can view any content on your site.',
    recommendation: 'Verify that the domain DNS records are properly configured and your origin web server or CDN is healthy.',
  },
  'tech-homepage-status': {
    title: 'Homepage HTTP Status Code',
    explanation: 'Confirms that the root landing page responds with a successful HTTP 200 OK status code.',
    whyItMatters: 'A non-200 status code on the homepage indicates server failure, broken configuration, or authorization blocks.',
    recommendation: 'Ensure your server routes the root URL to a working handler that returns a 200 OK status code.',
  },
  'tech-https-available': {
    title: 'HTTPS Encryption Protocol',
    explanation: 'Checks whether the website serves traffic securely using modern TLS/HTTPS encryption.',
    whyItMatters: 'Unencrypted HTTP exposes user data to eavesdropping and causes modern browsers to flag the site as insecure.',
    recommendation: 'Install a trusted TLS certificate and ensure all traffic is served over HTTPS.',
  },
  'tech-http-to-https-redirect': {
    title: 'HTTP to HTTPS Redirection',
    explanation: 'Ensures that insecure HTTP requests are automatically upgraded and redirected to HTTPS.',
    whyItMatters: 'Without an automatic redirect, visitors typing the bare domain into browser address bars may browse insecurely.',
    recommendation: 'Configure a server-level 301 permanent redirect from port 80 (HTTP) to port 443 (HTTPS).',
  },
  'tech-homepage-robots-block': {
    title: 'Homepage Blocked by Robots.txt',
    explanation: 'Inspects robots.txt rules to ensure standard search engine crawlers are permitted to index the homepage.',
    whyItMatters: 'A blanket "Disallow: /" rule completely prevents search engines from indexing the site in search results.',
    recommendation: 'Remove restrictive disallow directives affecting the root path or public landing pages from robots.txt.',
  },
  'tech-homepage-noindex': {
    title: 'Homepage Meta Robots Noindex',
    explanation: 'Checks if a <meta name="robots" content="noindex"> tag is inadvertently present on the homepage.',
    whyItMatters: 'The noindex directive instructs search engines to remove the homepage from their search indexes.',
    recommendation: 'Remove the noindex directive from meta tags on public production landing pages.',
  },
  'tech-x-robots-noindex': {
    title: 'X-Robots-Tag HTTP Header Blocking',
    explanation: 'Checks for HTTP response headers containing noindex or nofollow instructions.',
    whyItMatters: 'X-Robots-Tag headers override HTML directives and silently drop pages from search indexes.',
    recommendation: 'Remove X-Robots-Tag: noindex headers from origin server and reverse proxy configuration for production.',
  },
  'tech-redirect-loop': {
    title: 'Redirect Loop Detection',
    explanation: 'Ensures navigation does not trigger recursive or cyclic HTTP redirects.',
    whyItMatters: 'Redirect loops crash browser tabs and prevent users from ever reaching your web content.',
    recommendation: 'Inspect web server rewrite rules and CDN forwarding logic to eliminate circular redirects.',
  },
  'tech-server-5xx-errors': {
    title: 'Server 5xx Internal Errors',
    explanation: 'Identifies internal server errors (500, 502, 503, 504) returned across scanned pages.',
    whyItMatters: '5xx errors reflect severe backend crashes, unhandled exceptions, or database connection failures.',
    recommendation: 'Check backend application server logs and exception monitors to diagnose and patch crashing endpoints.',
  },
  'tech-staging-localhost-refs': {
    title: 'References to Staging or Localhost',
    explanation: 'Checks whether production pages contain hardcoded links or assets pointing to localhost, 127.0.0.1, or dev domains.',
    whyItMatters: 'Internal dev URLs will fail to resolve for public visitors, breaking navigation, stylesheets, and scripts.',
    recommendation: 'Replace hardcoded local or staging URLs with production domain URLs or root-relative paths.',
  },
  'tech-critical-pages-unreachable': {
    title: 'Critical Internal Pages Reachability',
    explanation: 'Checks whether primary internal navigation links resolve without connection failures or missing routes.',
    whyItMatters: 'Broken main navigation frustrates visitors and drops search engine discovery across your site.',
    recommendation: 'Audit your site navigation links and restore or redirect broken destination pages.',
  },

  // Category B: Crawlability / Discovery
  'crawl-robots-txt-exists': {
    title: 'Robots.txt Presence',
    explanation: 'Verifies whether a robots.txt file exists at the root of the domain.',
    whyItMatters: 'Robots.txt provides essential crawling directives and sitemap pointers for search engines.',
    recommendation: 'Publish a clean robots.txt file at the root of your domain (e.g., https://yourdomain.com/robots.txt).',
  },
  'crawl-robots-txt-accessible': {
    title: 'Robots.txt HTTP Accessibility',
    explanation: 'Ensures the robots.txt endpoint returns a clean HTTP 200 status code rather than 403 or 500.',
    whyItMatters: 'If crawlers receive a 5xx error when requesting robots.txt, they may pause crawling your entire website.',
    recommendation: 'Ensure your server routes /robots.txt as a public static text file with HTTP status 200.',
  },
  'crawl-sitemap-exists': {
    title: 'XML Sitemap Presence',
    explanation: 'Verifies whether at least one XML sitemap is declared or accessible at standard locations.',
    whyItMatters: 'XML sitemaps ensure search engines promptly discover newly published and updated pages.',
    recommendation: 'Generate a standard XML sitemap and declare its location in your robots.txt file.',
  },
  'crawl-sitemap-accessible': {
    title: 'XML Sitemap Accessibility',
    explanation: 'Confirms that declared XML sitemaps return a 200 OK status code without server errors.',
    whyItMatters: 'Inaccessible or 404 sitemaps prevent search engines from discovering your full URL hierarchy.',
    recommendation: 'Verify that the sitemap URL matches your build output path and is publicly accessible.',
  },
  'crawl-sitemap-valid-xml': {
    title: 'XML Sitemap Structure & Content',
    explanation: 'Validates that the sitemap contains well-formed XML and a valid set of discovered URLs.',
    whyItMatters: 'Malformed XML sitemaps are ignored by Google and other search engine indexers.',
    recommendation: 'Ensure your sitemap complies with the standard sitemaps.org schema and contains valid <url> nodes.',
  },
  'crawl-sitemap-broken-urls': {
    title: 'Sitemap Contains Broken URLs',
    explanation: 'Checks whether URLs listed in your sitemap returned 4xx or 5xx HTTP error codes when requested.',
    whyItMatters: 'Listing broken URLs in a sitemap wastes crawl budget and damages search engine quality signals.',
    recommendation: 'Purge broken, removed, or redirecting URLs from your XML sitemap generator.',
  },
  'crawl-sitemap-non-indexable': {
    title: 'Sitemap Contains Non-Indexable URLs',
    explanation: 'Identifies URLs declared in sitemaps that have noindex tags or are disallowed by robots.txt.',
    whyItMatters: 'Submitting URLs to search engines while simultaneously blocking them creates conflicting crawl directives.',
    recommendation: 'Only include canonical, 200 OK, publicly indexable URLs in your XML sitemaps.',
  },
  'crawl-sitemap-http-mismatch': {
    title: 'Sitemap Protocol Mismatch',
    explanation: 'Checks whether sitemap URLs use insecure http:// protocol while the website runs on https://.',
    whyItMatters: 'Protocol mismatches cause unnecessary redirects and hinder indexing.',
    recommendation: 'Update your sitemap generation pipeline to output absolute URLs with the https:// scheme.',
  },
  'crawl-sitemap-canonical-mismatch': {
    title: 'Sitemap Canonical URL Alignment',
    explanation: 'Checks if URLs declared in the sitemap match their own on-page canonical tags.',
    whyItMatters: 'When a sitemap URL points to a non-canonical target, search engines receive contradictory indexing signals.',
    recommendation: 'Ensure sitemap entries always reflect the exact canonical URL declared on the target page.',
  },
  'crawl-redirect-chains': {
    title: 'Redirect Chains & Hops',
    explanation: 'Detects URLs that pass through multiple redirect hops before reaching their final destination.',
    whyItMatters: 'Redirect chains slow down page load times and dilute link equity during search engine crawling.',
    recommendation: 'Update internal links and redirect rules to point directly to the final destination URL.',
  },
  'crawl-broken-internal-links': {
    title: 'Broken Internal Links',
    explanation: 'Detects internal links pointing to pages that return 4xx client errors or 5xx server errors.',
    whyItMatters: 'Broken links create dead ends for visitors and impair crawler traversal of your website.',
    recommendation: 'Update or remove broken hyperlink href attributes across your pages.',
  },
  'crawl-links-to-redirects': {
    title: 'Internal Links Pointing to Redirects',
    explanation: 'Finds internal links that point to URLs that redirect rather than directly to the destination.',
    whyItMatters: 'Linking through redirects introduces avoidable latency on every user click.',
    recommendation: 'Update internal anchor tags to link directly to the clean final destination URL.',
  },
  'crawl-crawl-depth': {
    title: 'Site Crawl Depth & Structure',
    explanation: 'Evaluates the click distance required to reach key pages from the homepage.',
    whyItMatters: 'Pages buried deep in the link hierarchy receive less crawl priority and organic traffic.',
    recommendation: 'Flatten your site architecture with clear header navigation, footer links, and contextual breadcrumbs.',
  },
  'crawl-duplicate-url-signals': {
    title: 'Duplicate URL & Slash Signals',
    explanation: 'Checks whether identical content is served on multiple URL variations (e.g., trailing slash vs non-trailing).',
    whyItMatters: 'Serving the same page on multiple URLs splits search ranking signals and creates duplicate content.',
    recommendation: 'Enforce a single URL format (trailing or non-trailing slash) with 301 redirects and canonical tags.',
  },

  // Category C: SEO
  'seo-missing-title': {
    title: 'Page Title Element',
    explanation: 'Verifies the presence of a <title> tag inside the document <head>.',
    whyItMatters: 'The title tag is the primary textual signal used by search engines and browser tabs to understand page topic.',
    recommendation: 'Add a descriptive <title> tag to every HTML page.',
  },
  'seo-empty-title': {
    title: 'Empty Page Title',
    explanation: 'Detects title elements that are blank or contain only whitespace characters.',
    whyItMatters: 'An empty title causes search engines to invent an arbitrary snippet in search results.',
    recommendation: 'Write a meaningful, distinct title summarizing the primary focus of the page.',
  },
  'seo-duplicate-titles': {
    title: 'Duplicate Page Titles',
    explanation: 'Identifies multiple distinct pages that share the exact same title tag.',
    whyItMatters: 'Duplicate titles cause search engine keyword cannibalization across your own pages.',
    recommendation: 'Ensure every page features a unique, contextually relevant title.',
  },
  'seo-title-length': {
    title: 'Page Title Length',
    explanation: 'Checks whether page titles fit within recommended display thresholds (30 to 65 characters).',
    whyItMatters: 'Titles that are too long will be truncated with an ellipsis in search engine results pages (SERPs).',
    recommendation: 'Keep primary page titles between 30 and 65 characters for optimal SERP presentation.',
  },
  'seo-missing-description': {
    title: 'Meta Description Presence',
    explanation: 'Checks for a <meta name="description"> tag in the document <head>.',
    whyItMatters: 'Meta descriptions provide the summary text displayed under your link in search results.',
    recommendation: 'Add a compelling meta description tag to summarize the content of each page.',
  },
  'seo-empty-description': {
    title: 'Empty Meta Description',
    explanation: 'Flags meta descriptions that exist but have blank or whitespace-only content.',
    whyItMatters: 'An empty meta description forces search engines to scrape arbitrary on-page text fragments.',
    recommendation: 'Provide a concise, informative description of the page content.',
  },
  'seo-duplicate-descriptions': {
    title: 'Duplicate Meta Descriptions',
    explanation: 'Identifies pages that share identical meta description strings.',
    whyItMatters: 'Duplicate descriptions make search snippets look repetitive and decrease organic click-through rates.',
    recommendation: 'Craft unique meta descriptions tailored to each individual page purpose.',
  },
  'seo-description-length': {
    title: 'Meta Description Length',
    explanation: 'Evaluates whether meta descriptions stay within optimal limits (70 to 160 characters).',
    whyItMatters: 'Descriptions exceeding 160 characters get cut off; descriptions under 70 characters may fail to engage readers.',
    recommendation: 'Tune meta descriptions to between 120 and 155 characters for maximum snippet impact.',
  },
  'seo-missing-h1': {
    title: 'Primary Heading (H1) Presence',
    explanation: 'Checks if the page contains at least one <h1> heading element.',
    whyItMatters: 'The H1 heading anchors the page content hierarchy for both screen readers and search crawlers.',
    recommendation: 'Include a clear, descriptive <h1> heading near the top of the main page body.',
  },
  'seo-multiple-h1': {
    title: 'Multiple H1 Headings',
    explanation: 'Checks whether the page contains more than one <h1> heading element.',
    whyItMatters: 'Having multiple H1 tags muddies the document hierarchy and can dilute main topic focus.',
    recommendation: 'Reserve <h1> for the primary page title and use <h2> through <h6> for subordinate subsections.',
  },
  'seo-heading-hierarchy': {
    title: 'Heading Level Hierarchy',
    explanation: 'Verifies that heading levels (H1 -> H2 -> H3) do not skip levels unexpectedly.',
    whyItMatters: 'Skipping levels (e.g., jumping from H1 directly to H4) disorients assistive technologies and screen readers.',
    recommendation: 'Structure headings sequentially without skipping levels in your document outline.',
  },
  'seo-missing-canonical': {
    title: 'Canonical URL Tag',
    explanation: 'Checks for the presence of a <link rel="canonical" href="..."> tag.',
    whyItMatters: 'Canonical tags clarify the preferred URL version to prevent indexing duplication from query parameters.',
    recommendation: 'Add a self-referential canonical link element to every indexable page.',
  },
  'seo-invalid-canonical': {
    title: 'Canonical URL Validity',
    explanation: 'Validates that the canonical URL is an absolute, syntactically valid web address.',
    whyItMatters: 'Malformed or relative canonical URLs are ignored by search engines.',
    recommendation: 'Specify the full absolute URL (including protocol and hostname) in the canonical link tag.',
  },
  'seo-canonical-mismatch': {
    title: 'Canonical Protocol / Domain Alignment',
    explanation: 'Checks whether canonical tags match the actual protocol and domain of the page.',
    whyItMatters: 'Conflicting canonical tags cause search engines to distrust or disregard your indexing preferences.',
    recommendation: 'Ensure canonical tags accurately match your current HTTPS domain convention.',
  },

  // Category D: Images / Assets
  'asset-broken-resources': {
    title: 'Broken Referenced Assets (CSS/JS/Fonts)',
    explanation: 'Detects referenced stylesheet, script, or font files that returned 4xx or 5xx HTTP errors.',
    whyItMatters: 'Missing CSS or JavaScript breaks visual styling, interactive functionality, and site usability.',
    recommendation: 'Fix the source paths or restore missing asset files in your web project bundle.',
  },
  'asset-missing-alt': {
    title: 'Image Alt Attributes',
    explanation: 'Checks whether <img> elements include an alt attribute for accessibility and screen readers.',
    whyItMatters: 'Missing alt attributes prevent visually impaired users and search crawlers from understanding images.',
    recommendation: 'Add an informative alt attribute to every image, or alt="" if purely decorative.',
  },
  'asset-empty-alt': {
    title: 'Empty Alt on Informative Images',
    explanation: 'Flags non-decorative images that have blank alt text without context.',
    whyItMatters: 'Users relying on screen readers will miss the context or purpose of the visual image.',
    recommendation: 'Provide concise descriptive text describing the visual subject or action in the image.',
  },
  'asset-oversized-images': {
    title: 'Oversized Image File Weights',
    explanation: 'Identifies image assets that exceed recommended file size thresholds (> 1 MB).',
    whyItMatters: 'Heavy uncompressed images consume mobile bandwidth and drastically slow down initial rendering.',
    recommendation: 'Compress images and adopt modern formats like WebP or AVIF with responsive srcset sizes.',
  },
  'asset-http-mixed-content': {
    title: 'Insecure HTTP Asset References',
    explanation: 'Detects images, stylesheets, or scripts loaded over insecure http:// on an https:// page.',
    whyItMatters: 'Modern browsers block mixed active content and display insecure connection warnings.',
    recommendation: 'Change all asset URLs to use https:// or relative paths.',
  },
  'asset-missing-dimensions': {
    title: 'Image Explicit Width and Height',
    explanation: 'Checks whether image elements define width and height attributes or aspect-ratio styling.',
    whyItMatters: 'Images without explicit dimensions cause Cumulative Layout Shift (CLS) as they load into the page.',
    recommendation: 'Specify width and height attributes on all <img> tags to reserve display space.',
  },

  // Category E: Performance Signals
  'perf-html-response-time': {
    title: 'Initial HTML Server Response Time',
    explanation: 'Measures Time to First Byte (TTFB) and initial document delivery latency.',
    whyItMatters: 'Slow server response delays every subsequent asset download and frustrates visitors.',
    recommendation: 'Leverage server-side caching, edge CDN caching, or optimize database queries.',
  },
  'perf-html-payload-size': {
    title: 'HTML Document Payload Size',
    explanation: 'Evaluates the raw uncompressed byte weight of the HTML document.',
    whyItMatters: 'Excessively large HTML documents take longer to download and parse on mobile CPUs.',
    recommendation: 'Minify HTML and avoid inlining massive SVG or data-URI assets directly in HTML templates.',
  },
  'perf-total-page-weight': {
    title: 'Total Scanned Page Weight',
    explanation: 'Sums the weight of the HTML document and sampled static resources.',
    whyItMatters: 'Heavy pages increase mobile load times, eat mobile data plans, and raise bounce rates.',
    recommendation: 'Optimize media, code-split JavaScript bundles, and defer non-critical assets.',
  },
  'perf-excessive-resources': {
    title: 'High Resource Request Count',
    explanation: 'Counts the number of external stylesheets, scripts, and font requests initiated by the page.',
    whyItMatters: 'Too many network round-trips can saturate browser connection limits and delay rendering.',
    recommendation: 'Consolidate scripts, bundle CSS, and eliminate unused third-party plugins.',
  },
  'perf-large-javascript': {
    title: 'Large JavaScript Bundles',
    explanation: 'Identifies individual JavaScript assets exceeding 500 KB.',
    whyItMatters: 'Heavy JavaScript bundles monopolize the main browser thread during compilation and execution.',
    recommendation: 'Implement route-based code splitting and tree-shake unused vendor dependencies.',
  },
  'perf-compression-missing': {
    title: 'HTTP Response Compression',
    explanation: 'Checks whether text-based responses are served with modern compression (Brotli or Gzip).',
    whyItMatters: 'Without compression, text payloads are 3x to 5x larger than necessary.',
    recommendation: 'Enable Brotli or Gzip compression on your web server or CDN distribution.',
  },
  'perf-cache-control': {
    title: 'Static Asset Cache Headers',
    explanation: 'Checks whether static resources include effective Cache-Control or ETag headers.',
    whyItMatters: 'Missing caching headers causes browsers to re-download unchanged static assets on repeat visits.',
    recommendation: 'Set long-lived Cache-Control headers (e.g., max-age=31536000, immutable) for fingerprinted assets.',
  },

  // Category F: Security
  'sec-hsts-missing': {
    title: 'Strict-Transport-Security (HSTS)',
    explanation: 'Checks for the presence of the Strict-Transport-Security HTTP response header.',
    whyItMatters: 'HSTS instructs browsers to only connect via HTTPS, preventing SSL-stripping attacks.',
    recommendation: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains" to your HTTPS response headers.',
  },
  'sec-content-security-policy': {
    title: 'Content-Security-Policy (CSP)',
    explanation: 'Checks whether a Content-Security-Policy header is configured to restrict resource execution.',
    whyItMatters: 'CSP protects against Cross-Site Scripting (XSS) and malicious script injection.',
    recommendation: 'Define a Content-Security-Policy header specifying allowed origins for scripts, styles, and frames.',
  },
  'sec-x-content-type-options': {
    title: 'X-Content-Type-Options Header',
    explanation: 'Checks for "X-Content-Type-Options: nosniff" on HTTP responses.',
    whyItMatters: 'Prevents browsers from MIME-sniffing a response away from the declared content-type.',
    recommendation: 'Configure your web server to return "X-Content-Type-Options: nosniff" on all responses.',
  },
  'sec-frame-protection': {
    title: 'Clickjacking Frame Protection',
    explanation: 'Checks for X-Frame-Options or CSP frame-ancestors to prevent malicious iframe embedding.',
    whyItMatters: 'Without clickjacking protection, third-party sites can invisibly frame your page to hijack user clicks.',
    recommendation: 'Set "X-Frame-Options: SAMEORIGIN" or CSP "frame-ancestors \'self\'" on sensitive pages.',
  },
  'sec-referrer-policy': {
    title: 'Referrer-Policy Header',
    explanation: 'Checks whether a Referrer-Policy header is configured to control referrer metadata transmission.',
    whyItMatters: 'Prevents sensitive URL paths and query parameters from leaking to external websites.',
    recommendation: 'Set "Referrer-Policy: strict-origin-when-cross-origin" in your web server response headers.',
  },
  'sec-permissions-policy': {
    title: 'Permissions-Policy Header',
    explanation: 'Checks for the modern Permissions-Policy header restricting sensitive browser APIs.',
    whyItMatters: 'Restricts untrusted scripts and embedded iframes from accessing camera, microphone, or geolocation.',
    recommendation: 'Define a Permissions-Policy header explicitly disabling unused browser hardware capabilities.',
  },

  // Category G: Accessibility / Mobile
  'a11y-missing-viewport': {
    title: 'Mobile Viewport Meta Tag',
    explanation: 'Verifies the presence of <meta name="viewport" content="width=device-width, initial-scale=1">.',
    whyItMatters: 'Without a viewport tag, mobile devices render pages at desktop scale, forcing users to pinch and zoom.',
    recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside the <head> tag.',
  },
  'a11y-missing-language': {
    title: 'HTML Language Attribute',
    explanation: 'Checks if the root <html> tag declares a valid lang attribute (e.g., <html lang="en">).',
    whyItMatters: 'Screen readers require the language attribute to pronounce text correctly and select correct speech engines.',
    recommendation: 'Add a valid ISO language code to the <html> tag, such as <html lang="en">.',
  },
  'a11y-duplicate-ids': {
    title: 'Duplicate HTML ID Attributes',
    explanation: 'Scans for repeated id attributes across elements on the same page.',
    whyItMatters: 'Duplicate IDs break DOM accessibility associations (like form labels) and client-side JavaScript targeting.',
    recommendation: 'Ensure all id attributes on a page are strictly unique.',
  },
  'a11y-unlabeled-form-controls': {
    title: 'Accessible Form Control Labels',
    explanation: 'Checks for form inputs, textareas, and select elements that lack associated labels or aria-labels.',
    whyItMatters: 'Users navigating with assistive screen readers cannot determine the intended input without labels.',
    recommendation: 'Associate form inputs with <label for="..."> elements or provide explicit aria-label attributes.',
  },
  'a11y-missing-iframe-titles': {
    title: 'Iframe Title Attributes',
    explanation: 'Checks whether embedded <iframe> elements define a descriptive title attribute.',
    whyItMatters: 'Screen reader users rely on iframe titles to understand embedded content without navigating into it.',
    recommendation: 'Add descriptive title attributes to all <iframe> tags (e.g., <iframe title="Product Demo Video">).',
  },
  'a11y-empty-links': {
    title: 'Empty Links and Interactive Controls',
    explanation: 'Identifies anchor links that contain no text, aria-label, or descriptive image alt content.',
    whyItMatters: 'Screen reader users will hear "link" without any clue where activating the link will take them.',
    recommendation: 'Provide meaningful anchor text or an aria-label attribute on all interactive links.',
  },

  // Optional Signals
  'opt-favicon': {
    title: 'Favicon Icon Presence',
    explanation: 'Checks for a declared favicon link tag in the document <head>.',
    whyItMatters: 'Favicons reinforce brand identity in browser tabs, bookmarks, and mobile home screens.',
    recommendation: 'Add a standard <link rel="icon" href="/favicon.ico"> tag to your document <head>.',
  },
  'opt-open-graph': {
    title: 'Open Graph Social Metadata',
    explanation: 'Checks for standard social sharing tags (og:title, og:description, og:image).',
    whyItMatters: 'Social platforms use Open Graph tags to generate rich visual link preview cards when shared.',
    recommendation: 'Add og:title, og:description, and og:image meta tags to key landing pages.',
  },
  'opt-structured-data': {
    title: 'Structured Data (Schema.org / JSON-LD)',
    explanation: 'Detects JSON-LD structured data scripts declaring organizational or page metadata.',
    whyItMatters: 'Structured data enables rich search results (rich snippets, FAQs, breadcrumbs) in Google search.',
    recommendation: 'Implement JSON-LD structured data appropriate for your website type (Organization, WebSite, Article).',
  },
};
