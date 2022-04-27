import {script} from '@digshare/script';
import RSSParser from 'rss-parser';

// 配置目标 RSS 地址。
const RSS_URLS = ['https://sspai.com/feed'];
// 如果需要多个地址，参考如下配置（地址前后加单引号，中间用逗号隔开）：
// const RSS_URLS = ['https://sspai.com/feed', 'https://vane.life/rss/'];

// 配置内容筛选关键字，空格隔开。
const KEYWORDS_SPACE_SEPARATED = '关键字 用空格 隔开 比如 app 软件';
// 如果不需要筛选关键字，则删除引号之间的内容，如下：
// const KEYWORDS_SPACE_SEPARATED = '';

const KEYWORDS = KEYWORDS_SPACE_SEPARATED
  ? KEYWORDS_SPACE_SEPARATED.toLowerCase().split(' ')
  : undefined;

const rssParser = new RSSParser();

interface Storage {
  seen: string[];
}

export default script<void, Storage>(async function* (_payload, {storage}) {
  // 取出之前就看到过的订阅内容 id，将其转化为 Set 数据结构，便于后续判断。
  const seenSet = new Set(storage.getItem('seen'));

  // 使用 RSS Parser 加载、解析目标 RSS 列表。
  const feeds = await Promise.all(RSS_URLS.map(url => rssParser.parseURL(url)));

  const items = feeds
    .flatMap(feed => feed.items)
    .sort(
      (x, y) =>
        new Date(y.pubDate ?? 0).getTime() - new Date(x.pubDate ?? 0).getTime(),
    );

  // 从加载的 RSS 订阅内容中筛选出之前没有看到过的内容。
  const unseenItems = items.filter(
    item =>
      // seenSet 中如果有 item.guid，就说明之前看到过。
      !!item.link && !seenSet.has(item.guid ?? item.link),
  );

  if (unseenItems.length === 0) {
    // 如果没有发现新内容，中断脚本。
    return;
  }

  // 把新内容的 id 加入看到过订阅内容 id 列表中。
  storage.setItem(
    'seen',
    [
      // 之前看到过的：
      ...seenSet,
      // 新内容的：
      ...unseenItems.map(item => item.guid ?? item.link!),
      // 只保留最近 10000 条记录：
    ].slice(-10000),
  );

  // 根据关键词筛选内容
  const filteredUnseenItems = KEYWORDS
    ? unseenItems.filter(item =>
        KEYWORDS.some(
          keyword =>
            (item.title?.toLowerCase().includes(keyword) ?? false) ||
            (item.content?.toLowerCase().includes(keyword) ??
              item.contentSnippet?.toLowerCase().includes(keyword) ??
              false),
        ),
      )
    : unseenItems;

  if (filteredUnseenItems.length === 0) {
    // 如果关键词筛选后没有新内容，中断脚本。
    return;
  }

  for (let item of filteredUnseenItems) {
    yield {
      content: `\
《${item.title}》

${item.content ?? item.contentSnippet}`,
      links: [
        {
          title: item.title,
          url: item.link!,
        },
      ],
    };
  }
});
