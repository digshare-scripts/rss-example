import {script} from '@digshare/script';
import RSSParser from 'rss-parser';

// 配置目标 RSS 地址。
const RSS_URL = 'https://vane.life/rss/';

const rssParser = new RSSParser();

interface Storage {
  seen: string[];
}

export default script<void, Storage>(async (_payload, {storage}) => {
  // 取出之前就看到过的订阅内容 id，将其转化为 Set 数据结构，便于后续判断。
  const seenSet = new Set(storage.getItem('seen'));

  // 使用 RSS Parser 加载、解析目标 RSS 列表。
  const feed = await rssParser.parseURL(RSS_URL);

  // 从加载的 RSS 订阅内容中筛选出之前没有看到过的内容。
  const unseenItems = feed.items.filter(
    item =>
      // seenSet 中如果有 item.guid，就说明之前看到过。
      !seenSet.has(item.guid!),
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
      ...unseenItems.map(item => item.guid!),
      // 只保留最近 10000 条记录：
    ].slice(-10000),
  );

  // 从新内容中取出前 3 条（主要怕一次性新内容太多，比如脚本第一次执行）。
  const mostRecentUnseenItems = unseenItems.slice(0, 3);

  return {
    content: `${feed.title} 发布了 ${unseenItems.length} 篇新内容。`,
    links: [
      // 提供链接：
      ...mostRecentUnseenItems.map(item => {
        return {
          // 链接标题使用订阅内容标题
          title: item.title!,
          // 链接描述使用订阅内容片段
          description: item.contentSnippet!,
          // 链接地址
          url: item.link!,
        };
      }),
    ],
  };
});
