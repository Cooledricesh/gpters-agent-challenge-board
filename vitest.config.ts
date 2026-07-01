import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 앱은 tsconfig paths로 "@/..."를 ./src로 해석한다. vitest도 동일하게 별칭을 맞춰,
// 컴포넌트 테스트에서 "@/components/..." 같은 import가 해석되게 한다.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
