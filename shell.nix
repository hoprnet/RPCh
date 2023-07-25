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
    nodejs-18_x
    (yarn.override { nodejs = nodejs-18_x; })
    # load testing
    k6

    # custom pkg groups
    linuxPkgs
    macosPkgs
  ];
}
