"use server";

export async function pingWebsite(url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { 
      method: "HEAD", 
      cache: "no-store",
      // Set a short timeout so it doesn't hang forever
      signal: AbortSignal.timeout(5000)
    });
    
    const end = Date.now();
    return {
      success: true,
      status: res.status,
      ok: res.ok,
      responseTime: end - start
    };
  } catch (error) {
    return {
      success: false,
      ok: false,
      responseTime: null
    };
  }
}

export async function getPageSpeedScore(url: string) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY${keyParam}`;
    
    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to fetch PageSpeed data");
    }

    const performance = data.lighthouseResult?.categories?.performance?.score;
    const seo = data.lighthouseResult?.categories?.seo?.score;
    const accessibility = data.lighthouseResult?.categories?.accessibility?.score;
    
    if (typeof performance === 'number') {
      return { 
        success: true, 
        score: Math.round(performance * 100),
        seoScore: typeof seo === 'number' ? Math.round(seo * 100) : null,
        accessibilityScore: typeof accessibility === 'number' ? Math.round(accessibility * 100) : null,
      };
    }
    
    return { success: false, error: "No score returned" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
