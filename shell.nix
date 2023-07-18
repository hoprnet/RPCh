{ pkgs ? import <nixpkgs> { } }:
let
  linuxPkgs = with pkgs; lib.optional stdenv.isLinux (
    inotify-tools
  );
  macosPkgs = with pkgs; lib.optional stdenv.isDarwin (
    with darwin.apple_sdk.frameworks; [
      CoreFoundation
      CoreServices
    ]
  );
in
with pkgs;
mkShell {
  nativeBuildInputs = [
    nodejs-16_x
    (yarn.override { nodejs = nodejs-16_x; })
    # load testing
    k6

    # custom pkg groups
    linuxPkgs
    macosPkgs
  ];
}
