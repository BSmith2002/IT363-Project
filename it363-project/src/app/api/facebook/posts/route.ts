import { NextResponse } from 'next/server';

export async function GET() {
  const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!PAGE_ID || !ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Missing Facebook credentials' }, { status: 500 });
  }
  try {
    const url = `https://graph.facebook.com/v24.0/${PAGE_ID}/posts?fields=message,created_time,full_picture,permalink_url&limit=4&access_token=${ACCESS_TOKEN}`;
    const fbRes = await fetch(url);
    const fbData = await fbRes.json();
    if (!fbData.data) {
      return NextResponse.json({ posts: [] });
    }
    const posts = fbData.data.map((post: any) => ({
      id: post.id,
      text: post.message || '',
      date: post.created_time ? new Date(post.created_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      image: post.full_picture || null,
      url: post.permalink_url || null
    }));
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Facebook posts', details: String(error) }, { status: 500 });
  }
}
