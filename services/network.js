const routes = require('../config/network-routes');

// IPv4 点分十进制 → 无符号 32 位整数
function ipToInt(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return (((parts[0] * 256 ** 3) + (parts[1] * 256 ** 2) + (parts[2] * 256) + parts[3]) >>> 0);
}

// 解析 CIDR，返回 { base: 网络地址, mask: 掩码 }（均为无符号 32 位）
function parseCidr(cidr) {
  const [ip, prefixStr] = String(cidr).split('/');
  const prefix = parseInt(prefixStr, 10);
  const ipInt = ipToInt(ip);
  if (ipInt == null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
  return { base: ((ipInt & mask) >>> 0), mask };
}

// 预解析所有路由，避免每次请求重复计算
const parsedRoutes = routes
  .map((r) => ({ route: r, cidr: parseCidr(r.cidr) }))
  .filter((x) => x.cidr);

// 从可能的 IPv6 映射地址（::ffff:1.2.3.4）中提取 IPv4
function normalizeIp(ip) {
  if (!ip) return null;
  const m = String(ip).match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  return m ? m[1] : null;
}

// 按来源 IP 命中网段路由；命中不到返回 null（由调用方走默认）
function getRouteByIp(ip) {
  const ipInt = ipToInt(normalizeIp(ip));
  if (ipInt == null) return null;
  for (const { route, cidr } of parsedRoutes) {
    if (((ipInt & cidr.mask) >>> 0) === cidr.base) {
      return route;
    }
  }
  return null;
}

module.exports = { getRouteByIp, normalizeIp };
