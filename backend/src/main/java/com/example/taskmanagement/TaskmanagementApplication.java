package com.example.taskmanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * アプリの入り口（起動するためのクラス）。
 *
 * <p>./gradlew bootRun を実行すると、このクラスの main メソッドが呼ばれてアプリが起動する。
 *
 * <p>@SpringBootApplication を付けると、Spring Boot が次のことを自動で行う。
 * <ul>
 *   <li>このクラスと同じパッケージ（com.example.taskmanagement）とその下にあるクラスを探し、
 *       @RestController などが付いたクラスを使えるように準備する</li>
 *   <li>build.gradle に書いたライブラリに合わせて設定を行う（例：Web のライブラリがあればサーバーの Tomcat を起動する）</li>
 * </ul>
 *
 * <p>そのため、これから作るクラスもこのパッケージの中（またはその下）に置く。
 */
@SpringBootApplication
public class TaskmanagementApplication {

	public static void main(String[] args) {
		// Spring Boot を起動する。起動すると http://localhost:8080 でアクセスを受け付ける
		SpringApplication.run(TaskmanagementApplication.class, args);
	}

}
