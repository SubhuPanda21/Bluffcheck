/* Seeded "AI-written" functions. Each has a realistic, subtle flaw (except one that is genuinely correct). */
const EX = [
    {
      id: 'binary-search', name: 'binarySearch', tag: 'off-by-one',
      blurb: 'Classic AI slip: the loop condition skips the last candidate.',
      shape: 'sorted-int[],int', claim: 'log', props: ['noMutation', 'deterministic'],
      code: `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {                     // looks fine, but misses lo === hi
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
      ref: `function binarySearch(arr, target) {
  return arr.indexOf(target);           // slow but obviously correct
}`,
    },
    {
      id: 'median', name: 'median', tag: 'two bugs',
      blurb: 'Wrong middle for even lengths, and it sorts the caller’s array in place.',
      shape: 'int[]', claim: 'nlogn', props: ['noMutation', 'deterministic'],
      code: `function median(nums) {
  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2
    ? nums[mid]
    : (nums[mid] + nums[mid + 1]) / 2;
}`,
      ref: `function median(nums) {
  if (!nums.length) return undefined;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}`,
    },
    {
      id: 'dedupe', name: 'dedupe', tag: 'slow bluff',
      blurb: 'Output is correct. The “O(n)” claim is not. Only the complexity probe catches it.',
      shape: 'int[]', claim: 'n', props: ['noMutation', 'deterministic'],
      code: `// "Linear-time dedupe preserving order"
function dedupe(arr) {
  return arr.filter((x, i) => arr.indexOf(x) === i);
}`,
      ref: `function dedupe(arr) {
  return [...new Set(arr)];
}`,
    },
    {
      id: 'merge-intervals', name: 'mergeIntervals', tag: 'edge case + mutation',
      blurb: 'Touching intervals like [1,2],[2,3] are not merged, and the input is re-ordered.',
      shape: 'intervals', claim: 'nlogn', props: ['noMutation', 'deterministic'],
      code: `function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of intervals) {
    const last = out[out.length - 1];
    if (last && s < last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}`,
      ref: `function mergeIntervals(iv) {
  const a = iv.map(x => [x[0], x[1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out = [];
  for (const [s, e] of a) {
    const l = out[out.length - 1];
    if (l && s <= l[1]) l[1] = Math.max(l[1], e);
    else out.push([s, e]);
  }
  return out;
}`,
    },
    {
      id: 'palindrome', name: 'isPalindrome', tag: 'wrong order of ops',
      blurb: 'Strips non-lowercase characters before lowercasing, so capitals vanish.',
      shape: 'string', claim: 'n', props: ['noMutation', 'deterministic'],
      code: `function isPalindrome(s) {
  const t = s.replace(/[^a-z0-9]/g, '');
  return t === t.split('').reverse().join('');
}`,
      ref: `function isPalindrome(s) {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0, j = t.length - 1; i < j; i++, j--) if (t[i] !== t[j]) return false;
  return true;
}`,
    },
    {
      id: 'floor-log2', name: 'floorLog2', tag: 'non-termination',
      blurb: 'Fine for n ≥ 1. For 0 or negatives the loop never ends. The loop guard catches it.',
      shape: 'int', claim: 'none', props: ['noMutation', 'deterministic'],
      code: `function floorLog2(n) {
  let r = 0;
  while (n !== 1) {
    n = n >> 1;
    r++;
  }
  return r;
}`,
      ref: `function floorLog2(n) {
  return n >= 1 ? Math.floor(Math.log2(n)) : -1;
}`,
    },
    {
      id: 'kadane', name: 'maxSubarray', tag: 'actually correct',
      blurb: 'A control: a correct, linear Kadane. BluffCheck should give it a clean bill of health.',
      shape: 'int[]', claim: 'n', props: ['noMutation', 'deterministic'],
      code: `function maxSubarray(nums) {
  if (nums.length === 0) return 0;
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}`,
      ref: `function maxSubarray(nums) {
  if (!nums.length) return 0;
  let best = -Infinity;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) { sum += nums[j]; if (sum > best) best = sum; }
  }
  return best;
}`,
    },
];

export default EX;
