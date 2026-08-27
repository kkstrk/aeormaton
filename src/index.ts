import "./utils/useEnv.js";

import { app } from "./app.js";

const port = process.env.PORT || 3333;

app.listen(port, () => console.log(`API available on http://localhost:${port}`));
