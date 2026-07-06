package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.dto.EmployeeTimesheetDTO;
import org.example.dto.timesheet.TimesheetFilterDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Slf4j
public class TimesheetHierarchyService {

    private final ObjectMapper objectMapper;

    @Value("${timesheet.hierarchy.sample-json}")
    private Resource sampleHierarchyResource;

    public EmployeeTimesheetDTO generateEnrichedHierarchy(TimesheetFilterDTO filter) throws IOException {
        log.info("Loading hierarchy sample for period {} - {}, manager={}",
                filter.getDateFrom(), filter.getDateTo(), filter.getManagerLogin());

        try (var inputStream = sampleHierarchyResource.getInputStream()) {
            return objectMapper.readValue(inputStream, EmployeeTimesheetDTO.class);
        }
    }
}
