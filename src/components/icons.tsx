import type { LucideProps } from "lucide-react";

export const Icons = {
  Logo: (props: LucideProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      {...props}
    >
      <path
        d="M192 64C192 64 128 64 96 128C64 192 64 192 64 192L128 128L192 64Z"
        fill="#0057B8"
      />
      <path
        d="M64 64H192L128 128L64 192V64Z"
        fill="#5595E8"
      />
    </svg>
  ),
};
