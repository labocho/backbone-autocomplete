#!/usr/bin/env ruby
require "sinatra"
require "json"

LIST = "
A
A+
ABAP
ABC
ABCL
ActionScript
ActiveBasic
Ada
Advanced Boolean Expression Language（ABEL）
Agena
AHDL
ALGOL
Alice
ash
APL
AppleScript
as
Atom
AutoIt
AWK
B
Bash
BASIC
BCPL
Befunge
BF-BASIC'n
Bioera
BLISS
Bluespec
Boo
BrainCrash
Brainfuck
C
C#
C++
CAL
Caml
Cantata
CAP-X
CASL
Cecil
CFScript（英語版）
Cg
Chapel
Chef
CHILL
Clipper
Clojure
CLU
Co-array Fortran
COBOL
CoffeeScript
Common Lisp
Component Pascal
Concurrent Clean
Concurrent Prolog
Constraint Handling Rules
CPL
csh
Curl
Curry
Cω
D
Dart
dBase
Delphi
Dylan
ECMAScript
Eiffel
Elixir
Enterprise Generation Language
Erlang
Escapade
Esterel
Euclid
Euphoria
F#
Factor
False
Fantom
Ferite
Ficl
Flavors
FlowDesigner
Forth
FORTRAN
Fortress
FoxPro
GLSL
Go
Groovy
Guarded Horn Clauses
HAL/S
Hardware Join Java
Haskell
Haxe
HDCaml
HLASM
HLSL
HML
HOLON
HSP
HQ9+
Hydra
HyperTalk
Icon
ID
IDL (interactive data language)
Inform
InScript
INTERCAL
Io
IPL
ISWIM
J
Java
Java FX Script（英語版）
JavaScript
JHDL
JScript .NET
J#
JSX
KEMURI
KL1
ksh
KRC
LabVIEW
Lazy K
Lava
Limbo
Linda
Linden Scripting Language (LSL)
Lingo
Lisaac
LISP
LOGO
Lola
LotusScript
Lua
Lucid
Lush
Lustre
Malbolge
Mana
MASM
Mathematica
Max
Mercury
Mesa
MIL/W
Mind
Mindscript
Miranda
Misa
MixJuice
ML
Modula-2
Modula-3
MONAmona
Mops
MQL
MSIL
MyHDL
M言語
Napier88
NASM
Nemerle
Noop
Oberon
Oberon-2
Object Pascal
Object REXX
Object Tcl (OTcl)
Objective-C
Objective Caml (OCaml)
Occam
Ook!
OpenOffice.org Basic
OPS
Oz
Pacbase
PALASM
PARLOG
Pascal
PBASIC
PCN (program composition notation)
Perl
PHP
Pic
Piet
Pike
pine
PL/0
PL/I
Planner
pnuts
PostScript
PowerBuilder
PowerShell
Processing
Prograph CPX
Prolog
Pure Data
PureScript
Pxem
Python
QtScript
R
REALbasic
REBOL
REXX
RHDL
RPG
Ruby（汎用プログラミング言語）
Ruby（ハードウェア記述言語）
Rust
SAL
SASL
Sather
Scala
Scheme
Scratch
Seed7
Self
SFL
sh
Shakespeare
Short Code
Simula
Simulink
SISAL
SKILL
Smalltalk
SMILEBASIC
SNOBOL
Squeak
Squirrel
Standard ML
superC
Swift
SystemC
SystemVerilog
t3x
TAL
Telescript
TeX
Tcl
tcsh
Tenems
TL/I
Tonyu System
TTS
TTSneo
Turing
TypeScript
Unified Parallel C （UPC）
Unlambda
UnrealScript
VBScript
Visual Basic .NET
VHDL
Whirl
Whitespace
WICS
WMLScript
Wyvern
X10
XQuery
XSLT
zsh
".lines.map(&:strip).reject{|l| l.size == 0 }

get "/" do
  redirect "/index.html"
end

get "/lang" do
  query = params[:q] || ""
  pattern = Regexp.compile("^" + Regexp.escape(query), Regexp::IGNORECASE)
  content_type "application/json"
  LIST.select{|i| i =~ pattern }.map{|i| {label: i, value: i} }.to_json
end

get "/backbone-autocomplete.js" do
  content_type "text/javascript"
  File.read(__dir__ + "/../dist/backbone-autocomplete.js")
end
