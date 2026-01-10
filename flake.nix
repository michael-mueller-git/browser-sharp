{
  description = "A Vite project built with Nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "browser-sharp";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "sha256-GkIBKfVj/MuBhrTrdHwjLYo6kyiPvy5ytmAoLT0dn/E=";
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r dist/* $out/
            runHook postInstall
          '';
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            nodePackages.npm
          ];
        };

        apps.default = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve-browser-sharp" ''
            set -eu
            ${pkgs.python3}/bin/python3 -m http.server 4173 -d ${self.packages.${system}.default}
          '');
        };
      }
    );
}
