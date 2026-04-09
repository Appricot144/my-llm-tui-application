# 構想

airisと通信するtui application

試験観点整理の一例が出ていたので、コードdiffから試験観点整理表（csv）を出力するまでのワークフローを使えるようにする。

- diff の出力プログラムの実行
- プロンプトの適用

を一機能として取り込む

ワークフローを作成する機能とかあったら便利かもしれないけど、やらない。多分必要ない。

```
"Content-Type": "application/json",
"Authorization": f"Bearer <api_key> <tool_name>"

```

https://use-search-ai.azurewebsites.net/personal_airis/proxy/bedrock/model/claude-sonnet-4-6/invoke