package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.dto.EmployeeTimesheetDTO;
import org.example.dto.timesheet.TimesheetFilterDTO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class TimesheetHierarchyServiceTest {

    @Autowired
    private TimesheetHierarchyService timesheetHierarchyService;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${timesheet.hierarchy.sample-json}")
    private Resource sampleHierarchyResource;

    @Test
    void generateEnrichedHierarchy_returnsThreeLevelTreeFromJson() throws Exception {
        TimesheetFilterDTO filter = TimesheetFilterDTO.builder()
                .dateFrom(java.time.LocalDate.of(2026, 6, 1))
                .dateTo(java.time.LocalDate.of(2026, 6, 30))
                .managerLogin("pavelin")
                .build();

        EmployeeTimesheetDTO root = timesheetHierarchyService.generateEnrichedHierarchy(filter);

        assertNotNull(root);
        assertEquals("pavelin", root.getAdLogin());
        assertFalse(root.getChildren().isEmpty());
        assertEquals(0, root.getLevel());
        assertEquals(1, root.getChildren().get(0).getLevel());
        assertEquals(2, root.getChildren().get(0).getChildren().get(0).getLevel());
    }

    @Test
    void sampleJson_isValidEmployeeTimesheetDto() throws Exception {
        EmployeeTimesheetDTO dto;
        try (var in = sampleHierarchyResource.getInputStream()) {
            dto = objectMapper.readValue(in, EmployeeTimesheetDTO.class);
        }
        assertEquals("Павел Иванов", dto.getEmployeeName());
    }
}
