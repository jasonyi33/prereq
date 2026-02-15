declare module "jsrsasign" {
  export namespace KJUR {
    namespace jws {
      namespace JWS {
        function sign(
          alg: string,
          header: string,
          payload: string,
          key: string
        ): string;
      }
    }
  }
}
