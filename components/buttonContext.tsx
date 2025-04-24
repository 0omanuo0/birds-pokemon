


export default function ButtonContext({ children, bgcolor }: { children: React.ReactNode, bgcolor: string }) {

    return (
        <button
            
            onClick={() => alert("asd")}
            className={"pointer-events-auto shadow-lg border-2 border-neutral-700 h-12 w-12 rounded-full nth-[2]:mb-12 flex items-center justify-center " + bgcolor}
        >{children}</button>
    )

}