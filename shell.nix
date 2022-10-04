{ pkgs ? import <nixpkgs> { }, ... }:
let
  linuxPkgs = with pkgs; lib.optional stdenv.isLinux (
    inotifyTools
  );
  macosPkgs = with pkgs; lib.optional stdenv.isDarwin (
    with darwin.apple_sdk.frameworks; [
      # macOS file watcher support
      CoreFoundation
      CoreServices
    ]
  );
in
with pkgs;
mkShell {
  buildInputs = [
    ## base
    envsubst

    nodejs-16_x # v16.5.0
    (yarn.override { nodejs = nodejs-16_x; }) # v1.22.10

    # publish tooling
    google-cloud-sdk

    # custom pkg groups
    macosPkgs
    linuxPkgs
  ];
}
