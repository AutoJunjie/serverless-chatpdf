import { SSTConfig } from "sst";
import { API } from "./stacks/APIM";

export default {
  config(_input) {
    return {
      name: "chatpdf",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(API);
  }
} satisfies SSTConfig;
