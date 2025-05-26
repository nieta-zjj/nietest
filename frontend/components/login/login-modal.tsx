"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Checkbox,
  Form,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { useAuth } from "@/lib/auth/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, isLoading, error: authError } = useAuth();

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    try {
      console.log(`尝试登录，用户名: ${email}`);
      // 使用email作为username参数传递给login函数
      const success = await login(email, password);

      if (success) {
        console.log("登录成功");
        onLoginSuccess();
      } else if (!authError) {
        // 如果没有来自AuthContext的错误，但登录仍然失败
        setLocalError("登录失败，请检查用户名和密码");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLocalError(`网络错误，请稍后重试: ${errorMessage}`);
      console.error("登录请求失败:", err);
    }
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      classNames={{
        backdrop: "bg-gradient-to-t from-zinc-900/50 to-zinc-900/50",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h1 className="text-large font-medium">登录您的账户</h1>
              <p className="text-small text-default-500">继续访问系统</p>
            </ModalHeader>
            <ModalBody>
              {(localError || authError) && (
                <div className="bg-danger-50 text-danger border border-danger-200 rounded-md p-3 mb-2 text-sm">
                  {localError || authError}
                </div>
              )}

              <Form className="flex flex-col gap-3" validationBehavior="native" onSubmit={handleSubmit}>
                <Input
                  isRequired
                  label="用户名"
                  name="username"
                  placeholder="请输入您的用户名"
                  type="text"
                  variant="bordered"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  isRequired
                  endContent={
                    <button type="button" onClick={toggleVisibility}>
                      {isVisible ? (
                        <Icon
                          className="pointer-events-none text-2xl text-default-400"
                          icon="solar:eye-closed-linear"
                        />
                      ) : (
                        <Icon
                          className="pointer-events-none text-2xl text-default-400"
                          icon="solar:eye-bold"
                        />
                      )}
                    </button>
                  }
                  label="密码"
                  name="password"
                  placeholder="请输入您的密码"
                  type={isVisible ? "text" : "password"}
                  variant="bordered"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex w-full items-center px-1 py-2">
                  <Checkbox
                    name="remember"
                    size="sm"
                    isSelected={rememberMe}
                    onValueChange={setRememberMe}
                  >
                    记住我
                  </Checkbox>
                </div>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                取消
              </Button>
              <Button
                color="primary"
                isLoading={isLoading}
                onPress={() => {
                  const form = document.querySelector("form");
                  if (form) {
                    form.requestSubmit();
                  }
                }}
              >
                登录
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
