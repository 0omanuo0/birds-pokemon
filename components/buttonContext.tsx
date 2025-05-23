import { useRouter } from "next/navigation"



export default function ButtonContext({ children, bgcolor, href }: { children: React.ReactNode, bgcolor: string, href?: string }) {
    const router = useRouter();
    return (
        <button
            style={{
                filter: "drop-shadow(4px 4px 6px rgba(0, 0, 0, 0.3))",
                boxShadow: "inset -2px -2px 6px 1px #1717144, inset 2px 2px 6px 1px #fff6",
                color: "#ddd"
            }}
            onClick={() => href && router.push(href)}
            className={"pointer-events-auto shadow-lg border-2 border-neutral-700 h-12 w-12 rounded-full nth-[2]:mb-12 flex items-center justify-center " + bgcolor}
        >{children}</button>
    )

}