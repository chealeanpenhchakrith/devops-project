const url = 'http://myapp.dev.svc.cluster.local/health';
let ok = 0;
let fail = 0;
const start = Date.now();
const limit = Number(process.env.PROBE_MS || 45000);

(async () => {
  while (Date.now() - start < limit) {
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        ok += 1;
      } else {
        fail += 1;
      }
    } catch (error) {
      fail += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.log(`ok=${ok} fail=${fail} duration=${Date.now() - start}ms`);
})();
