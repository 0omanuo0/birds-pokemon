"use client";

import DeviceScreen, { DeviceControls } from "@/components/device/deviceScreen";
import LateralLeft from "@/components/nav/lateralLeft";
import LateralRight from "@/components/nav/lateralRight";
import { burgerSvg, CameraSvg, userSvg } from "@/components/imageSvg";
import { CursorBall, CursorProvider, StopScroll } from "@/components/device/cursor";
import AroundYou from "./aroundYou";

// Today: bird of the day, your month page, who you may meet, the season's changes, your last trip (components/today/aroundYou.tsx).
// Getting around is on the device body: the red tabs open the camera, the profile and the dex.
export default function TodayHome() {
    return (
        <CursorProvider>
            <DeviceScreen>
                <StopScroll>
                    <AroundYou />
                </StopScroll>
            </DeviceScreen>
            <DeviceControls>
                <LateralLeft offsetY={16} n={2} positionIDX={0} target='/identify' label="Camera">{CameraSvg}</LateralLeft>
                <LateralLeft offsetY={16} n={2} positionIDX={1} target='/user' label="User">{userSvg}</LateralLeft>
                <LateralRight target='/pokedex' label="Pokedex">{burgerSvg}</LateralRight>
                <CursorBall />
            </DeviceControls>
        </CursorProvider>
    );
}
